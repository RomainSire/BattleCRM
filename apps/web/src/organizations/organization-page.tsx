import { ORGANIZATION_NAME_MAX_LENGTH, type OrganizationType } from '@battlecrm/contract';
import { normalizeName, organizationsMatching } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Form, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../components/ui/combobox.tsx';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { OfflineNote } from '../components/ui/offline-note.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { ContactName } from '../contacts/contact-name.tsx';
import { ORGANIZATION_TYPE_LABEL } from '../contacts/organization-field.tsx';
import { prospectingStageOf, STATUS_LABEL } from '../contacts/status.ts';
import { useSendGesture } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import {
  summaryQuery,
  type Summary,
  type SummaryContact,
  type SummaryOrganization,
} from '../summary.ts';
import { useIsNarrow } from '../use-narrow.ts';

/** The other type: there are two (CONTEXT.md, Organization). */
const otherType = (type: OrganizationType): OrganizationType =>
  type === 'consultancy' ? 'end_client' : 'consultancy';

/**
 * Why a gesture on an Organization (spec UX §5.4) failed, in its dialog or under its form: any refusal
 * means the data changed on another device (the Organization or the other one gone, a name taken).
 * Never undone (spec UX §1), such a gesture answers no token: its notification has no “Undo”.
 */
const gestureError = (gesture: { isError: boolean; data: object | undefined }) =>
  gesture.isError
    ? m.auth_error()
    : gesture.data !== undefined && m.organization_changed_elsewhere();

/** A Contact of the Organization: its Stage, its Status and its next action (spec UX §5.4). */
function MemberRow({ contact, summary }: { contact: SummaryContact; summary: Summary }) {
  const details = [
    prospectingStageOf(contact, summary.stages),
    STATUS_LABEL[contact.status](),
    // No Follow-up nor Trial yet: their signal comes with their tickets (21, 28).
    contact.status === 'prospecting' ? m.no_next_action() : undefined,
  ].filter(Boolean);
  return (
    <li className="flex flex-col gap-0.5 px-3 py-2">
      <Link
        to="/contacts/$contactId"
        params={{ contactId: contact.id }}
        className={cn(
          'self-start rounded-control underline-offset-4 focus-ring hover:underline',
          contact.status === 'archived' ? 'text-neutral-text' : 'font-medium',
        )}
      >
        <ContactName contact={contact} />
      </Link>
      <span className="text-xs text-neutral-text">{details.join(' · ')}</span>
    </li>
  );
}

/**
 * The name, edited in place: unique among the User's Organizations, case, accents and spaces aside
 * (ST-30). `Enter` saves, `Escape` cancels; either way `onDone` gives the actions back.
 */
function RenameOrganization({
  organization,
  organizations,
  onDone,
}: {
  organization: SummaryOrganization;
  organizations: SummaryOrganization[];
  onDone: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [name, setName] = useState(organization.name);
  const rename = useMutation({
    mutationFn: (typed: string) =>
      sendGesture(
        api.organizations[':id'].rename.$post({
          param: { id: organization.id },
          json: { name: typed },
        }),
        ({ organizations: [renamed] }) =>
          renamed && m.organization_renamed({ organization: renamed.name }),
      ),
    onSuccess: (refused) => {
      if (!refused) onDone();
    },
  });
  const isTaken = (candidate: string) =>
    organizations.some(
      ({ id, name: other }) =>
        id !== organization.id && normalizeName(other) === normalizeName(candidate),
    );
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape from the field cancels the rename.
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDone();
      }}
    >
      <Form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (rename.isPending) return;
          if (name.trim() === organization.name) onDone();
          else rename.mutate(name);
        }}
      >
        <TextField
          name="name"
          value={name}
          onChange={setName}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- “Rename” was just pressed: the field takes the focus, which saving or cancelling gives back.
          autoFocus
          autoComplete="off"
          maxLength={ORGANIZATION_NAME_MAX_LENGTH}
          validate={(candidate) =>
            candidate.trim() === ''
              ? m.organization_name_required()
              : isTaken(candidate)
                ? m.organization_name_taken()
                : null
          }
          className="flex max-w-sm flex-col gap-1.5"
        >
          <Label>{m.organization_name()}</Label>
          <Input className="max-md:h-11" />
          <FieldErrorMessage />
        </TextField>
        <ErrorMessage>{gestureError(rename)}</ErrorMessage>
        <div className="flex gap-2">
          <Button type="submit" size="sm" isDisabled={rename.isPending}>
            {m.save()}
          </Button>
          <Button variant="outline" size="sm" onPress={onDone}>
            {m.cancel()}
          </Button>
        </div>
      </Form>
    </div>
  );
}

/** A confirmation (spec UX §1): what the gesture does, then do it or cancel. */
function Confirmation({
  isOpen,
  onOpenChange,
  title,
  confirmLabel,
  isDisabled,
  error,
  onConfirm,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
  confirmLabel: string;
  isDisabled: boolean;
  error: string | false;
  onConfirm: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {children}
      <ErrorMessage>{error}</ErrorMessage>
      <OfflineNote />
      <DialogFooter>
        <DialogClose>{m.cancel()}</DialogClose>
        <Button isDisabled={isDisabled} saves onPress={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** What a change of the Target does to the Contacts that change it (CONTEXT.md, Organization). */
const targetsChange = (count: number, type: OrganizationType) =>
  `${m.organization_targets_change({ count, target: ORGANIZATION_TYPE_LABEL[type]() })} ${m.organization_trials_keep_target()}`;

/**
 * Changing the type: the Target of its Contacts follows. With Contacts, a window says so and asks to
 * confirm; without one, it changes at once (spec UX §5.4).
 */
function ChangeType({
  organization,
  memberCount,
}: {
  organization: SummaryOrganization;
  memberCount: number;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [isOpen, setIsOpen] = useState(false);
  const type = otherType(organization.type);
  const typeLabel = ORGANIZATION_TYPE_LABEL[type]();
  const change = useMutation({
    mutationFn: () =>
      sendGesture(
        api.organizations[':id']['change-type'].$post({
          param: { id: organization.id },
          json: { type },
        }),
        () => m.organization_type_changed({ organization: organization.name, type: typeLabel }),
      ),
    onSuccess: (refused) => {
      if (!refused) setIsOpen(false);
    },
  });
  const label = m.organization_change_type({ type: typeLabel });
  if (memberCount === 0) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          isDisabled={change.isPending}
          saves
          onPress={() => change.mutate()}
        >
          {label}
        </Button>
        <ErrorMessage>{gestureError(change)}</ErrorMessage>
      </>
    );
  }
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setIsOpen(true)}>
        {`${label}…`}
      </Button>
      <Confirmation
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) change.reset();
        }}
        title={m.organization_change_type_title({
          organization: organization.name,
          type: typeLabel,
        })}
        confirmLabel={label}
        isDisabled={change.isPending}
        error={gestureError(change)}
        onConfirm={() => change.mutate()}
      >
        <DialogDescription>{targetsChange(memberCount, type)}</DialogDescription>
      </Confirmation>
    </>
  );
}

/**
 * “Merge with…” (ST-31): the other Organization, then the one that stays, the one chosen by default.
 * The Contacts of the other one join it and take its type; the other one goes. One transaction.
 */
function MergeOrganization({
  organization,
  summary,
}: {
  organization: SummaryOrganization;
  summary: Summary;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [otherId, setOtherId] = useState<string | null>(null);
  const [keptId, setKeptId] = useState<string | null>(null);
  const [wasSent, setWasSent] = useState(false);
  const others = summary.organizations.filter(({ id }) => id !== organization.id);
  const other = others.find(({ id }) => id === otherId);
  const kept = other && (keptId === organization.id ? organization : other);
  const removed = other && (kept === other ? organization : other);
  const merge = useMutation({
    mutationFn: ({ from, into }: { from: SummaryOrganization; into: SummaryOrganization }) =>
      sendGesture(
        api.organizations[':id'].merge.$post({
          param: { id: from.id },
          json: { intoId: into.id },
        }),
        () => m.organization_merged({ removed: from.name, kept: into.name }),
      ),
    onSuccess: (refused, { from, into }) => {
      if (refused) return;
      setIsOpen(false);
      // The page that went leads to the one that stays.
      if (from.id === organization.id) {
        void navigate({
          to: '/organizations/$organizationId',
          params: { organizationId: into.id },
          replace: true,
        });
      }
    },
  });
  const moving = removed
    ? summary.contacts.filter(({ organizationId }) => organizationId === removed.id).length
    : 0;
  const consequences =
    kept &&
    removed &&
    [
      moving === 0
        ? m.organization_merge_moves_none()
        : m.organization_merge_moves({ count: moving, organization: kept.name }),
      m.organization_merge_removed({ organization: removed.name }),
      moving > 0 && kept.type !== removed.type && targetsChange(moving, kept.type),
    ]
      .filter(Boolean)
      .join(' ');
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setIsOpen(true)}>
        {m.organization_merge()}
      </Button>
      <Confirmation
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) return;
          // Nothing is kept from one opening to the next.
          setText('');
          setOtherId(null);
          setKeptId(null);
          setWasSent(false);
          merge.reset();
        }}
        title={m.organization_merge_title({ organization: organization.name })}
        confirmLabel={m.organization_merge_confirm()}
        isDisabled={merge.isPending}
        error={gestureError(merge)}
        onConfirm={() => {
          setWasSent(true);
          if (kept && removed) merge.mutate({ from: removed, into: kept });
        }}
      >
        <Combobox
          inputValue={text}
          onInputChange={(typed) => {
            setText(typed);
            // A choice holds only while its name is written in full.
            if (typed !== other?.name) setOtherId(null);
          }}
          selectedKey={otherId}
          onSelectionChange={(key) => {
            const chosen = others.find(({ id }) => id === key);
            setOtherId(chosen?.id ?? null);
            setKeptId(chosen?.id ?? null);
            if (chosen) setText(chosen.name);
          }}
          items={organizationsMatching(text, others)}
          allowsEmptyCollection
          // Required, checked when the merge is confirmed.
          isInvalid={wasSent && !other}
          validationBehavior="aria"
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_organization()}</Label>
          <ComboboxInput showTrigger className="max-md:h-11" />
          <FieldErrorMessage>{m.organization_merge_choose()}</FieldErrorMessage>
          <ComboboxContent>
            <ComboboxList<SummaryOrganization>
              renderEmptyState={() => (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  {m.organization_merge_no_match()}
                </p>
              )}
            >
              {(choice) => <ComboboxItem id={choice.id}>{choice.name}</ComboboxItem>}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {other && kept && (
          <>
            <SegmentedControl value={kept.id} onChange={setKeptId}>
              <Label>{m.organization_merge_kept()}</Label>
              <SegmentedControlItems>
                {[other, organization].map((choice) => (
                  <SegmentedControlItem key={choice.id} value={choice.id}>
                    {choice.name}
                  </SegmentedControlItem>
                ))}
              </SegmentedControlItems>
            </SegmentedControl>
            <DialogDescription>{consequences}</DialogDescription>
          </>
        )}
      </Confirmation>
    </>
  );
}

/** Deleting, only once no Contact belongs to it: never automatic (CONTEXT.md, Organization). */
function DeleteOrganization({ organization }: { organization: SummaryOrganization }) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const remove = useMutation({
    mutationFn: () =>
      sendGesture(api.organizations[':id'].delete.$post({ param: { id: organization.id } }), () =>
        m.organization_deleted({ organization: organization.name }),
      ),
    onSuccess: (refused) => {
      if (refused) return;
      setIsOpen(false);
      void navigate({ to: '/contacts', replace: true });
    },
  });
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setIsOpen(true)}>
        {m.organization_delete()}
      </Button>
      <Confirmation
        isOpen={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) remove.reset();
        }}
        title={m.organization_delete_title({ organization: organization.name })}
        confirmLabel={m.organization_delete_confirm()}
        isDisabled={remove.isPending}
        error={gestureError(remove)}
        onConfirm={() => remove.mutate()}
      >
        <DialogDescription>{m.organization_delete_body()}</DialogDescription>
      </Confirmation>
    </>
  );
}

/**
 * The page of an Organization (spec UX §5.4), under Contacts: its name, its type and its Contacts. On
 * desktop, it is renamed, changes type, merges and is deleted; on mobile, it is read only.
 */
export function OrganizationPage({ organizationId }: { organizationId: string }) {
  useLocale();
  const api = useApi();
  const isNarrow = useIsNarrow();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const [isRenaming, setIsRenaming] = useState(false);
  const renameButton = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(false);
  // Saving or cancelling gives the focus back to “Rename”, once the button is back on the screen.
  useEffect(() => {
    if (wasRenaming.current && !isRenaming) renameButton.current?.focus();
    wasRenaming.current = isRenaming;
  }, [isRenaming]);
  const contactsHeadingId = useId();
  const organization = summary?.organizations.find(({ id }) => id === organizationId);
  const backToContacts = (
    <Link to="/contacts" className="rounded-control underline-offset-4 focus-ring hover:underline">
      {m.contacts()}
    </Link>
  );

  let content;
  if (!summary) {
    // Kept on the device, the summary still reads when the API does not answer (ADR 0004).
    content = <ErrorMessage>{isError && m.contacts_load_error()}</ErrorMessage>;
  } else if (!organization) {
    content = (
      <>
        <p className="text-muted-foreground">{m.organization_unknown()}</p>
        <p>{backToContacts}</p>
      </>
    );
  } else {
    const members = summary.contacts
      .filter((contact) => contact.organizationId === organization.id)
      .toSorted((a, b) => a.name.localeCompare(b.name));
    content = (
      <>
        <nav aria-label={m.breadcrumb()}>
          <ol className="flex gap-1.5 text-xs text-muted-foreground">
            <li>{backToContacts}</li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="truncate">
              {organization.name}
            </li>
          </ol>
        </nav>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-lg font-semibold">{organization.name}</h1>
          <p className="text-muted-foreground">{ORGANIZATION_TYPE_LABEL[organization.type]()}</p>
        </div>
        {!isNarrow &&
          (isRenaming ? (
            <RenameOrganization
              organization={organization}
              organizations={summary.organizations}
              onDone={() => setIsRenaming(false)}
            />
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              <Button
                ref={renameButton}
                variant="outline"
                size="sm"
                onPress={() => setIsRenaming(true)}
              >
                {m.organization_rename()}
              </Button>
              <ChangeType organization={organization} memberCount={members.length} />
              <MergeOrganization organization={organization} summary={summary} />
              {members.length === 0 && <DeleteOrganization organization={organization} />}
            </div>
          ))}
        <section aria-labelledby={contactsHeadingId} className="flex max-w-2xl flex-col gap-2">
          <h2
            id={contactsHeadingId}
            className="text-xs font-semibold text-muted-foreground uppercase"
          >
            {m.contacts()}
          </h2>
          {members.length === 0 ? (
            <p className="text-muted-foreground">{m.organization_no_contacts()}</p>
          ) : (
            <ul
              aria-label={m.organization_contacts({ organization: organization.name })}
              className="flex flex-col divide-y rounded-card border"
            >
              {members.map((contact) => (
                <MemberRow key={contact.id} contact={contact} summary={summary} />
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <title>{`${organization?.name ?? m.contacts()} · BattleCRM`}</title>
      {content}
    </div>
  );
}
