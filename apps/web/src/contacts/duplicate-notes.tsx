import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useNavigate } from '@tanstack/react-router';
import { InfoIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Text } from 'react-aria-components';

import type { Summary, SummaryContact } from '../summary.ts';

/** A Contact as the checks name it: “Jean Dupont · Capgemini”. */
export const contactLabel = (contact: SummaryContact, organizations: Summary['organizations']) => {
  const organization = organizations.find(({ id }) => id === contact.organizationId);
  return organization ? `${contact.name} · ${organization.name}` : contact.name;
};

/** What the duplicate checks found, only worth knowing (spec UX §6.8): discreet, never an error. */
export function DuplicateNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text slot="description" className="flex items-start gap-1.5 text-sm text-neutral-text">
      <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </Text>
  );
}

/**
 * The Contact that already has this LinkedIn profile (spec UX §6.8, §6.12), which blocks: named, with
 * “Open their record”, which leaves the form first.
 */
export function LinkedInTaken({
  owner,
  organizations,
  onLeave,
}: {
  owner: SummaryContact | undefined;
  organizations: Summary['organizations'];
  onLeave: () => void;
}) {
  const navigate = useNavigate();
  if (!owner) return null;
  return (
    <ErrorMessage>
      {m.contact_exists({ contact: contactLabel(owner, organizations) })}{' '}
      <Button
        variant="link"
        className="h-auto p-0 align-baseline"
        onPress={() => {
          onLeave();
          void navigate({ to: '/contacts', search: { contact: owner.id } });
        }}
      >
        {m.open_contact()}
      </Button>
    </ErrorMessage>
  );
}
