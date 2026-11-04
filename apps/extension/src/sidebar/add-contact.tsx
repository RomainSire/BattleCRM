import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
  type AddableContactStatus,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import {
  Button,
  ErrorMessage,
  FieldErrorMessage,
  Input,
  Label,
  OrganizationField,
  organizationOf,
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
  Textarea,
  type OrganizationDraft,
} from '@battlecrm/ui';
import { useId, useState } from 'react';
import { Form, Link, TextField } from 'react-aria-components';

import type {
  AddOutcome,
  NewContact,
  OrganizationChoice,
  ProfileReading,
  SameNameContact,
  StageChoice,
} from '../messages.ts';
import { STATUS_LABEL } from '../status.ts';
import { linkClass, ScreenTitle } from './layout.tsx';

/** What the form holds: it belongs to the profile, and is lost with it (spec extension §4). */
export type Draft = {
  name: string;
  jobTitle: string;
  organization: OrganizationDraft;
  email: string;
  phone: string;
  note: string;
  status: AddableContactStatus;
  /** None chosen: the first Stage of the Funnel. */
  stageId: string | undefined;
};

/**
 * The form as the page fills it (spec extension §4, §6): what was read, a field not read left empty,
 * the note never. An Organization read is the User's own when its name is the same, case, accents and
 * spaces aside; a new one otherwise, its type to choose. In the Pool, every time.
 */
export function draftOf(
  reading: ProfileReading | null,
  organizations: readonly OrganizationChoice[],
): Draft {
  const read: OrganizationDraft = { text: reading?.organizationName ?? '', type: null };
  const named = organizationOf(read, organizations);
  return {
    name: reading?.name ?? '',
    jobTitle: reading?.jobTitle ?? '',
    organization: named.kind === 'existing' ? { ...read, text: named.organization.name } : read,
    email: reading?.email ?? '',
    phone: reading?.phone ?? '',
    note: '',
    status: 'pool',
    stageId: undefined,
  };
}

/** Whether a field is sent: only when filled. */
const isFilled = (text: string) => text.trim() !== '';

/** What `POST /contacts` is sent, as it is (spec extension §8); `null` while a type is missing. */
function newContactOf(
  draft: Draft,
  linkedinUrl: string,
  organizations: readonly OrganizationChoice[],
  stageId: string | undefined,
): NewContact | null {
  const organization = organizationOf(draft.organization, organizations);
  if (organization.kind === 'new' && organization.type === null) return null;
  return {
    name: draft.name,
    status: draft.status,
    ...(draft.status === 'prospecting' && stageId !== undefined && { stageId }),
    ...(organization.kind === 'existing' && { organizationId: organization.organization.id }),
    ...(organization.kind === 'new' &&
      organization.type !== null && {
        newOrganization: { name: organization.name, type: organization.type },
      }),
    linkedinUrl,
    ...(isFilled(draft.jobTitle) && { jobTitle: draft.jobTitle }),
    ...(isFilled(draft.email) && { email: draft.email }),
    ...(isFilled(draft.phone) && { phone: draft.phone }),
    ...(isFilled(draft.note) && { note: draft.note }),
  };
}

/** A refusal as the form says it; an addition, or a profile taken, never shows here. */
function refusalText(outcome: AddOutcome | undefined, failed: boolean) {
  if (failed) return m.auth_error();
  if (outcome?.status !== 'refused') return false;
  if (outcome.error === 'unknown_stage') return m.contact_stage_gone();
  if (outcome.error === 'organization_taken') return m.organization_taken();
  return m.auth_error();
}

/** A Contact of the same name, as its line names it: “Jean Dupont · Capgemini”. */
const contactLabel = ({ name, organizationName }: SameNameContact) =>
  organizationName === null ? name : `${name} · ${organizationName}`;

/**
 * The form to add the Contact of a LinkedIn profile (spec extension §4): the quick add of the app,
 * every field shown, the LinkedIn URL shown and disabled. `Enter` adds it; no `Ctrl Enter`, the
 * gestures of the Funnel are for its record in the app. The Contacts of the same name are only worth
 * knowing; a profile that could not be read is said above, and blocks nothing either.
 */
export function AddContactForm({
  linkedinUrl,
  appOrigin,
  sameName,
  organizations,
  stages,
  draft,
  onChange,
  onReadAgain,
  isReading,
  unreadable,
  onAdd,
  isAdding,
  outcome,
  failed,
}: {
  linkedinUrl: string;
  appOrigin: string;
  sameName: readonly SameNameContact[];
  organizations: readonly OrganizationChoice[];
  stages: readonly StageChoice[];
  draft: Draft;
  /** The fields the User changed: a reading of the page leaves them alone. */
  onChange: (fields: Partial<Draft>) => void;
  /** “Read the page again”. */
  onReadAgain: () => void;
  isReading: boolean;
  /** The page shows no profile the extension can read (spec extension §7). */
  unreadable: boolean;
  onAdd: (contact: NewContact) => void;
  isAdding: boolean;
  /** The answer to the latest addition, for its refusal. */
  outcome: AddOutcome | undefined;
  /** The background did not answer it. */
  failed: boolean;
}) {
  const stageFieldId = useId();
  const [wasSent, setWasSent] = useState(false);
  // A Stage chosen and gone from the Funnel since: the first one again.
  const stageId = stages.some(({ id }) => id === draft.stageId) ? draft.stageId : stages[0]?.id;
  return (
    <>
      <ScreenTitle>{m.add_contact()}</ScreenTitle>
      {unreadable && (
        // A status: said by a screen reader once the wait is over, never blocking.
        <output className="block rounded-control border px-3 py-2 text-sm text-neutral-text">
          {m.extension_unreadable_profile()}
        </output>
      )}
      <Button variant="outline" className="self-start" isDisabled={isReading} onPress={onReadAgain}>
        {m.extension_read_page_again()}
      </Button>
      <Form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          const contact = newContactOf(draft, linkedinUrl, organizations, stageId);
          if (!isAdding && contact !== null) onAdd(contact);
        }}
      >
        <TextField
          name="name"
          value={draft.name}
          onChange={(name) => onChange({ name })}
          autoComplete="off"
          maxLength={CONTACT_NAME_MAX_LENGTH}
          validate={(name) => (name.trim() === '' ? m.contact_name_required() : null)}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_name()}</Label>
          <Input />
          <FieldErrorMessage />
        </TextField>
        {sameName.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-neutral-text">
            {sameName.map((contact) => (
              <li key={contact.id}>
                {m.extension_same_name({ contact: contactLabel(contact) })}{' '}
                <Link
                  href={`${appOrigin}/contacts/${contact.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClass}
                >
                  {m.open_contact()}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <TextField
          name="jobTitle"
          value={draft.jobTitle}
          onChange={(jobTitle) => onChange({ jobTitle })}
          maxLength={CONTACT_JOB_TITLE_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_job_title()}</Label>
          <Input />
        </TextField>
        <OrganizationField
          draft={draft.organization}
          onChange={(organization) => onChange({ organization })}
          organizations={organizations}
          isTypeMissing={wasSent}
          // Filled from the page: emptied as when it is edited in the app.
          offersNone
        />
        <TextField
          name="email"
          value={draft.email}
          onChange={(email) => onChange({ email })}
          autoComplete="off"
          maxLength={CONTACT_EMAIL_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_email()}</Label>
          <Input inputMode="email" />
        </TextField>
        <TextField
          name="phone"
          type="tel"
          value={draft.phone}
          onChange={(phone) => onChange({ phone })}
          autoComplete="off"
          maxLength={CONTACT_PHONE_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_phone()}</Label>
          <Input />
        </TextField>
        <TextField
          name="note"
          value={draft.note}
          onChange={(note) => onChange({ note })}
          maxLength={CONTACT_NOTE_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_note()}</Label>
          <Textarea />
        </TextField>
        {/* What goes into BattleCRM, never changed: it is the profile's. */}
        <TextField value={linkedinUrl} isDisabled className="flex flex-col gap-1.5">
          <Label>{m.contact_linkedin_url()}</Label>
          <Input />
        </TextField>
        <SegmentedControl
          value={draft.status}
          onChange={(value) => {
            const status = ADDABLE_CONTACT_STATUSES.find((candidate) => candidate === value);
            if (status) onChange({ status });
          }}
        >
          <Label>{m.contact_status()}</Label>
          <SegmentedControlItems>
            {ADDABLE_CONTACT_STATUSES.map((status) => (
              <SegmentedControlItem key={status} value={status}>
                {STATUS_LABEL[status]()}
              </SegmentedControlItem>
            ))}
          </SegmentedControlItems>
        </SegmentedControl>
        {draft.status === 'prospecting' && stages.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={stageFieldId}>{m.contact_stage()}</Label>
            <select
              id={stageFieldId}
              value={stageId}
              onChange={(event) => onChange({ stageId: event.target.value })}
              className="h-8 w-full rounded-control border border-input bg-background px-2 text-sm focus-ring"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <ErrorMessage>{refusalText(outcome, failed)}</ErrorMessage>
        <Button type="submit" className="self-start" isDisabled={isAdding}>
          {m.add()}
        </Button>
      </Form>
    </>
  );
}
