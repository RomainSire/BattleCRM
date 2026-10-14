import { ORGANIZATION_TYPES, type OrganizationType } from '@battlecrm/contract';
import { normalizeName, organizationsMatching } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../components/ui/combobox.tsx';
import { FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import type { SummaryOrganization } from '../summary.ts';

/** The type of an Organization as the User reads it. */
export const ORGANIZATION_TYPE_LABEL: Record<OrganizationType, () => string> = {
  consultancy: m.organization_type_consultancy,
  end_client: m.organization_type_end_client,
};

/** What the field holds: the name typed, and the type chosen for a new Organization. */
export type OrganizationDraft = { text: string; type: OrganizationType | null };

export const NO_ORGANIZATION: OrganizationDraft = { text: '', type: null };

/**
 * The Organization a draft names: an existing one when its name is typed in full, case, accents and
 * spaces aside (ST-30); a new one otherwise; none when the field is blank.
 */
export function organizationOf(draft: OrganizationDraft, organizations: SummaryOrganization[]) {
  const name = draft.text.trim();
  if (name === '') return { kind: 'none' } as const;
  const wanted = normalizeName(name);
  const existing = organizations.find((candidate) => normalizeName(candidate.name) === wanted);
  if (existing) return { kind: 'existing', organization: existing } as const;
  return { kind: 'new', name, type: draft.type } as const;
}

/**
 * The Organization of a Contact (spec UX §6.8): chosen in a list filtered as it is typed, or created
 * with its type, which the User chooses.
 */
export function OrganizationField({
  draft,
  onChange,
  organizations,
  isTypeMissing,
}: {
  draft: OrganizationDraft;
  onChange: (draft: OrganizationDraft) => void;
  organizations: SummaryOrganization[];
  /** The form was sent without the type of a new Organization. */
  isTypeMissing: boolean;
}) {
  const named = organizationOf(draft, organizations);
  return (
    <>
      <Combobox
        inputValue={draft.text}
        onInputChange={(text) => onChange({ ...draft, text })}
        // A choice in the list writes its name in full, which names it.
        onSelectionChange={(key) => {
          const chosen = organizations.find(({ id }) => id === key);
          if (chosen) onChange({ ...draft, text: chosen.name });
        }}
        items={organizationsMatching(draft.text, organizations)}
        allowsCustomValue
        allowsEmptyCollection
        className="flex flex-col gap-1.5"
      >
        <Label>{m.contact_organization()}</Label>
        <ComboboxInput showTrigger={organizations.length > 0} className="max-md:h-11" />
        <ComboboxContent>
          <ComboboxList<SummaryOrganization>
            renderEmptyState={() => (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {m.no_organization_matches()}
              </p>
            )}
          >
            {(organization) => (
              <ComboboxItem id={organization.id}>{organization.name}</ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {named.kind === 'new' && (
        <SegmentedControl
          value={draft.type}
          onChange={(value) => {
            const type = ORGANIZATION_TYPES.find((candidate) => candidate === value);
            if (type) onChange({ ...draft, type });
          }}
          // Required, checked by the form when it is sent: a radio group has no message of its own.
          isInvalid={isTypeMissing && draft.type === null}
          validationBehavior="aria"
        >
          <Label>{m.organization_type()}</Label>
          <SegmentedControlItems>
            {ORGANIZATION_TYPES.map((type) => (
              <SegmentedControlItem key={type} value={type}>
                {ORGANIZATION_TYPE_LABEL[type]()}
              </SegmentedControlItem>
            ))}
          </SegmentedControlItems>
          <FieldErrorMessage>{m.organization_type_required()}</FieldErrorMessage>
        </SegmentedControl>
      )}
    </>
  );
}
