import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_JOB_TITLE_MAX_LENGTH,
  CONTACT_LINKEDIN_URL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_NOTE_MAX_LENGTH,
  CONTACT_PHONE_MAX_LENGTH,
} from '@battlecrm/contract';
import { findDuplicates, normalizeLinkedInUrl, type Target } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import {
  Button,
  ErrorMessage,
  FieldErrorMessage,
  Input,
  invalidInputClass,
  Label,
  Textarea,
} from '@battlecrm/ui';
import { useMutation } from '@tanstack/react-query';
import { useDeferredValue, useId, useState } from 'react';
import { Form, TextField } from 'react-aria-components';

import { useSendGesture } from '../gesture.ts';
import { useApi } from '../session.ts';
import { type Summary, type SummaryContact } from '../summary.ts';
import { contactLabel, DuplicateNote, LinkedInTaken } from './duplicate-notes.tsx';
import {
  OrganizationField,
  organizationOf,
  targetText,
  type OrganizationDraft,
} from './organization-field.tsx';

/** A field of the Contact sent only when filled: left out, it is emptied. */
const filled = (text: string) => text.trim() || undefined;

/**
 * The Coordinates of a Contact, edited in place (spec UX §6.12): the same checks as the quick add,
 * and what a change of Organization changes. Neither the Stage nor the Status. `Enter` in a field of
 * one line saves, `Escape` cancels; either way `onDone` gives the block back.
 */
export function EditCoordinates({
  contact,
  note,
  summary,
  onDone,
}: {
  contact: SummaryContact;
  /** The note, read with the record: it is not in the summary. */
  note: string | null;
  summary: Summary;
  onDone: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const changesId = useId();
  const { organizations, contacts } = summary;
  const current = organizations.find(({ id }) => id === contact.organizationId);
  const [name, setName] = useState(contact.name);
  const [jobTitle, setJobTitle] = useState(contact.jobTitle ?? '');
  const [organizationDraft, setOrganizationDraft] = useState<OrganizationDraft>({
    text: current?.name ?? '',
    type: null,
  });
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [linkedinUrl, setLinkedinUrl] = useState(contact.linkedinUrl ?? '');
  const [noteText, setNoteText] = useState(note ?? '');
  const [wasSent, setWasSent] = useState(false);
  const organization = organizationOf(organizationDraft, organizations);
  const organizationId = organization.kind === 'existing' ? organization.organization.id : null;
  const changesOrganization =
    organization.kind === 'new' || organizationId !== contact.organizationId;
  const typed = { id: contact.id, name, organizationId, linkedinUrl, email, phone };
  // Checked as it is typed, behind the keystrokes, never against itself (ST-64).
  const duplicates = findDuplicates(useDeferredValue(typed), contacts);
  const [sameName] = duplicates.sameName;
  const [sameEmail] = duplicates.sameEmail;
  const [samePhone] = duplicates.samePhone;
  const isUnchanged =
    !changesOrganization &&
    name.trim() === contact.name &&
    (filled(jobTitle) ?? null) === contact.jobTitle &&
    (filled(email) ?? null) === contact.email &&
    (filled(phone) ?? null) === contact.phone &&
    (filled(linkedinUrl) ?? null) === contact.linkedinUrl &&
    (filled(noteText) ?? null) === note;
  const edit = useMutation({
    mutationFn: () =>
      sendGesture(
        api.contacts[':id'].edit.$post({
          param: { id: contact.id },
          json: {
            name,
            ...(organizationId !== null && { organizationId }),
            ...(organization.kind === 'new' &&
              organization.type && {
                newOrganization: { name: organization.name, type: organization.type },
              }),
            linkedinUrl: filled(linkedinUrl),
            jobTitle: filled(jobTitle),
            email: filled(email),
            phone: filled(phone),
            note: filled(noteText),
          },
        }),
        ({ contacts: [edited] }) => edited && m.contact_edited({ name: edited.name }),
      ),
    onSuccess: (refused) => {
      if (!refused) onDone();
    },
  });

  /** What the Target becomes; unknown while the type of a new Organization is not chosen. */
  const newTarget: Target | undefined =
    organization.kind === 'none'
      ? 'unknown'
      : organization.kind === 'existing'
        ? organization.organization.type
        : (organization.type ?? undefined);

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape from any field of the form cancels the edit.
    <div
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // Never the panel's Escape too, which would close it.
        event.stopPropagation();
        // An open list of Organizations closes first: it keeps its Escape.
        if (event.target instanceof HTMLElement && event.target.ariaExpanded === 'true') return;
        onDone();
      }}
    >
      <Form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (edit.isPending || (organization.kind === 'new' && organization.type === null)) return;
          // Never checked on Enter: a duplicate profile already says so, and blocks (spec UX §6.12).
          if (findDuplicates(typed, contacts).sameLinkedIn) return;
          if (isUnchanged) onDone();
          else edit.mutate();
        }}
      >
        <TextField
          name="name"
          value={name}
          onChange={setName}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- “Edit” was just pressed: the first field takes the focus, which saving or cancelling gives back.
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
        <TextField
          name="jobTitle"
          value={jobTitle}
          onChange={setJobTitle}
          maxLength={CONTACT_JOB_TITLE_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_job_title()}</Label>
          <Input className="max-md:h-11" />
        </TextField>
        <OrganizationField
          draft={organizationDraft}
          onChange={setOrganizationDraft}
          organizations={organizations}
          isTypeMissing={wasSent}
          offersNone
        />
        {changesOrganization && (
          <section aria-labelledby={changesId} className="rounded-control border p-3">
            <p
              id={changesId}
              className="mb-1 text-xs font-semibold text-muted-foreground uppercase"
            >
              {m.contact_edit_changes()}
            </p>
            <ul className="list-disc pl-5 text-sm">
              {newTarget && (
                <li>{m.contact_edit_changes_target({ target: targetText(newTarget) })}</li>
              )}
              {/* Only a Contact Prospecting may have a Trial in progress; ticket 28 narrows it to one that has. */}
              {contact.status === 'prospecting' && <li>{m.contact_edit_changes_trial()}</li>}
              <li>{m.contact_edit_changes_no_interaction()}</li>
              {organization.kind === 'new' && (
                <li>
                  {m.contact_edit_changes_organization_created({ organization: organization.name })}
                </li>
              )}
            </ul>
          </section>
        )}
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
            {sameEmail && m.contact_same_email({ contact: contactLabel(sameEmail, organizations) })}
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
            {samePhone && m.contact_same_phone({ contact: contactLabel(samePhone, organizations) })}
          </DuplicateNote>
        </TextField>
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
        <TextField
          name="note"
          value={noteText}
          onChange={setNoteText}
          maxLength={CONTACT_NOTE_MAX_LENGTH}
          className="flex flex-col gap-1.5"
        >
          <Label>{m.contact_note()}</Label>
          <Textarea />
        </TextField>
        <ErrorMessage>
          {edit.isError
            ? m.auth_error()
            : // Any other refusal, of data changed on another device: the checks then show the
              // Contact that has the profile, or the Organization or the Contact gone.
              edit.data?.error === 'organization_taken' && m.organization_taken_on_edit()}
        </ErrorMessage>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="max-md:min-h-11" isDisabled={edit.isPending}>
            {m.save()}
          </Button>
          <Button variant="outline" size="sm" className="max-md:min-h-11" onPress={onDone}>
            {m.cancel()}
          </Button>
        </div>
      </Form>
    </div>
  );
}
