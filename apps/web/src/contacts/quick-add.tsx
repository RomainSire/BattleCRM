import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_LINKEDIN_URL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  type AddableContactStatus,
} from '@battlecrm/contract';
import { findDuplicates, funnelOf, normalizeLinkedInUrl } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useId, useRef, useState } from 'react';
import { Form, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input, invalidInputClass } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { summaryQuery, type Summary, type SummaryContact } from '../summary.ts';
import type { QuickAddStart } from './add-contact-context.ts';
import { contactLabel, DuplicateNote, LinkedInTaken } from './duplicate-notes.tsx';
import {
  NO_ORGANIZATION,
  OrganizationField,
  organizationOf,
  type OrganizationDraft,
} from './organization-field.tsx';
import { prospectingStageOf, STATUS_LABEL } from './status.ts';

/**
 * The quick add of a Contact (spec UX §6.8): a modal opened by `N` or “+ Add”. A name, its
 * Organization, its LinkedIn profile, and the Status it is added in: the Pool by default, Prospecting
 * at a Stage, or Ally; “More fields” opens the rest. Nothing is kept from one opening to the next.
 * `Ctrl Enter` adds it Prospecting and goes on to send it a Positioning (spec UX §6.1).
 */
export function QuickAdd({
  isOpen,
  onOpenChange,
  start,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** A name already typed and a Status already chosen, from the page Circle (spec UX §5.11). */
  start?: QuickAddStart | undefined;
}) {
  useLocale();
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>{m.add_contact()}</DialogTitle>
      </DialogHeader>
      <QuickAddForm onDone={() => onOpenChange(false)} start={start} />
    </Dialog>
  );
}

/** A field of the Contact sent only when filled. */
const filled = (text: string) => text.trim() || undefined;

function QuickAddForm({
  onDone,
  start,
}: {
  onDone: () => void;
  start?: QuickAddStart | undefined;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  // Set by `Ctrl Enter` for the submission it starts.
  const sendsNext = useRef(false);
  const stageFieldId = useId();
  // The summary the shell reads, not read again for a modal: the Stages of the Funnel, the
  // Organizations and the Contacts the checks compare with, without a round trip (ADR 0012).
  const summary = useQuery({ ...summaryQuery(api), refetchOnMount: false }).data;
  const stages = summary?.stages ?? [];
  const organizations = summary?.organizations ?? [];
  const contacts = summary?.contacts ?? [];
  const funnel = funnelOf(stages);
  const [name, setName] = useState(start?.name ?? '');
  const [organizationDraft, setOrganizationDraft] = useState<OrganizationDraft>(NO_ORGANIZATION);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [status, setStatus] = useState<AddableContactStatus>(start?.status ?? 'pool');
  // None chosen yet: the first Stage not archived, as the API would take it.
  const [chosenStageId, setChosenStageId] = useState<string>();
  const stageId = chosenStageId ?? funnel[0]?.id;
  const [showsMoreFields, setShowsMoreFields] = useState(false);
  const [wasSent, setWasSent] = useState(false);
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const organization = organizationOf(organizationDraft, organizations);
  const organizationId = organization.kind === 'existing' ? organization.organization.id : null;
  const typed = { name, organizationId, linkedinUrl, email, phone };
  // Checked as it is typed, behind the keystrokes so that typing never waits for them (ST-64).
  const duplicates = findDuplicates(useDeferredValue(typed), contacts);
  const [sameName] = duplicates.sameName;
  const [sameEmail] = duplicates.sameEmail;
  const [samePhone] = duplicates.samePhone;
  const add = useMutation({
    mutationFn: async ({ sendNext }: { sendNext: boolean }) => {
      // `Ctrl Enter` adds it Prospecting, whatever the Status chosen.
      const addedStatus = sendNext ? 'prospecting' : status;
      let addedId: string | undefined;
      const refused = await sendGesture(
        api.contacts.$post({
          json: {
            name,
            status: addedStatus,
            ...(addedStatus === 'prospecting' && stageId !== undefined && { stageId }),
            ...(organizationId !== null && { organizationId }),
            ...(organization.kind === 'new' &&
              organization.type && {
                newOrganization: { name: organization.name, type: organization.type },
              }),
            linkedinUrl: filled(linkedinUrl),
            jobTitle: filled(jobTitle),
            email: filled(email),
            phone: filled(phone),
            note: filled(note),
          },
        }),
        ({ contacts: [added] }) => {
          addedId = added?.id;
          return added && addedMessage(added, stages);
        },
      );
      return { refused, sendTo: sendNext ? addedId : undefined };
    },
    onSuccess: ({ refused, sendTo }) => {
      if (refused) {
        if (refused.error === 'unknown_stage') setChosenStageId(undefined);
        return;
      }
      onDone();
      if (sendTo !== undefined) {
        void navigate({
          to: '/contacts/$contactId',
          params: { contactId: sendTo },
          search: { send: 'positioning' },
        });
      }
    },
  });
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- `Ctrl Enter` from any field (spec UX §6.8).
    <div
      className="contents"
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        if (event.target instanceof HTMLTextAreaElement) return;
        event.preventDefault();
        sendsNext.current = true;
        formRef.current?.requestSubmit();
      }}
    >
      <Form
        ref={formRef}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const sendNext = sendsNext.current;
          sendsNext.current = false;
          setWasSent(true);
          if (add.isPending || (organization.kind === 'new' && organization.type === null)) return;
          // Never checked on Enter: a duplicate profile already says so, and blocks (spec UX §6.8).
          if (findDuplicates(typed, contacts).sameLinkedIn) return;
          add.mutate({ sendNext });
        }}
      >
        <TextField
          name="name"
          value={name}
          onChange={setName}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- the User just opened this modal to type a name: its field takes the focus, which closing gives back.
          autoFocus
          autoComplete="off"
          maxLength={CONTACT_NAME_MAX_LENGTH}
          validate={(candidate) => (candidate.trim() === '' ? m.contact_name_required() : null)}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_name()}</Label>
          <Input className="max-md:h-11" />
          <FieldErrorMessage />
          <DuplicateNote>
            {sameName &&
              (duplicates.sameNameInOrganization && organization.kind === 'existing'
                ? m.contact_same_name_in_organization({
                    organization: organization.organization.name,
                  })
                : m.contact_same_name({ contact: contactLabel(sameName, organizations) }))}
          </DuplicateNote>
        </TextField>
        <OrganizationField
          draft={organizationDraft}
          onChange={setOrganizationDraft}
          organizations={organizations}
          isTypeMissing={wasSent}
        />
        <TextField
          name="linkedinUrl"
          value={linkedinUrl}
          onChange={setLinkedinUrl}
          autoComplete="off"
          maxLength={CONTACT_LINKEDIN_URL_MAX_LENGTH}
          validate={(url) =>
            url.trim() !== '' && normalizeLinkedInUrl(url) === null
              ? m.contact_linkedin_url_invalid()
              : null
          }
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_linkedin_url()}</Label>
          <Input
            inputMode="url"
            className={duplicates.sameLinkedIn ? `${invalidInputClass} max-md:h-11` : 'max-md:h-11'}
          />
          <FieldErrorMessage />
        </TextField>
        <LinkedInTaken
          owner={duplicates.sameLinkedIn}
          organizations={organizations}
          onLeave={onDone}
        />
        <SegmentedControl
          value={status}
          onChange={(value) => {
            const chosen = ADDABLE_CONTACT_STATUSES.find((candidate) => candidate === value);
            if (chosen) setStatus(chosen);
          }}
        >
          <Label>{m.contact_status()}</Label>
          <SegmentedControlItems>
            {ADDABLE_CONTACT_STATUSES.map((candidate) => (
              <SegmentedControlItem key={candidate} value={candidate}>
                {STATUS_LABEL[candidate]()}
              </SegmentedControlItem>
            ))}
          </SegmentedControlItems>
        </SegmentedControl>
        {status === 'prospecting' && funnel.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={stageFieldId}>{m.contact_stage()}</Label>
            <select
              id={stageFieldId}
              value={stageId}
              onChange={(event) => setChosenStageId(event.target.value)}
              className="h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm"
            >
              {funnel.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {showsMoreFields ? (
          <>
            <TextField
              name="jobTitle"
              value={jobTitle}
              onChange={setJobTitle}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- “More fields” was just pressed: the first of them takes the focus.
              autoFocus
              maxLength={CONTACT_JOB_TITLE_MAX_LENGTH}
              className="flex flex-col gap-1.5"
            >
              <Label>{m.contact_job_title()}</Label>
              <Input className="max-md:h-11" />
            </TextField>
            <TextField
              name="email"
              value={email}
              onChange={setEmail}
              autoComplete="off"
              maxLength={CONTACT_EMAIL_MAX_LENGTH}
              className="flex flex-col gap-1.5"
            >
              <Label>{m.contact_email()}</Label>
              <Input inputMode="email" className="max-md:h-11" />
              <DuplicateNote>
                {sameEmail &&
                  m.contact_same_email({ contact: contactLabel(sameEmail, organizations) })}
              </DuplicateNote>
            </TextField>
            <TextField
              name="phone"
              type="tel"
              value={phone}
              onChange={setPhone}
              autoComplete="off"
              maxLength={CONTACT_PHONE_MAX_LENGTH}
              className="flex flex-col gap-1.5"
            >
              <Label>{m.contact_phone()}</Label>
              <Input className="max-md:h-11" />
              <DuplicateNote>
                {samePhone &&
                  m.contact_same_phone({ contact: contactLabel(samePhone, organizations) })}
              </DuplicateNote>
            </TextField>
            <TextField
              name="note"
              value={note}
              onChange={setNote}
              maxLength={CONTACT_NOTE_MAX_LENGTH}
              className="flex flex-col gap-1.5"
            >
              <Label>{m.contact_note()}</Label>
              <Textarea />
            </TextField>
          </>
        ) : (
          <Button
            variant="link"
            className="h-auto self-start p-0"
            onPress={() => setShowsMoreFields(true)}
          >
            {m.more_fields()}
          </Button>
        )}
        <ErrorMessage>{add.isError ? m.auth_error() : refusalText(add.data?.refused)}</ErrorMessage>
        <p className="text-sm text-muted-foreground max-md:hidden">{m.quick_add_send_hint()}</p>
        <DialogFooter>
          <Button type="submit" className="max-md:min-h-11" isDisabled={add.isPending}>
            {m.add()}
          </Button>
        </DialogFooter>
      </Form>
    </div>
  );
}

/**
 * Refusals of data this device is behind on, changed on another one, as the quick add shows them;
 * nothing for a profile taken, which the checks then show with the Contact that has it.
 */
function refusalText(refused: RefusalOf<ApiClient['contacts']['$post']> | undefined) {
  switch (refused?.error) {
    case undefined:
    case 'linkedin_url_taken':
      return false;
    case 'unknown_stage':
      return m.contact_stage_gone();
    case 'organization_taken':
      return m.organization_taken();
    default:
      return m.auth_error();
  }
}

/** What the notification says, by the Status the Contact was added in (spec UX §10). */
function addedMessage(added: SummaryContact, stages: Summary['stages']): string {
  const { name } = added;
  switch (added.status) {
    case 'prospecting': {
      const stage = prospectingStageOf(added, stages);
      return stage
        ? m.contact_entered_funnel({ name, stage })
        : m.contact_entered_funnel_anywhere({ name });
    }
    case 'ally':
      return m.contact_entered_circle({ name });
    default:
      return m.contact_added_to_pool({ name });
  }
}
