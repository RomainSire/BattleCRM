import { m } from '@battlecrm/i18n';
import { getLocale } from '@battlecrm/i18n/runtime';
import { LinkButton } from '@battlecrm/ui';

import type { ContactCard } from '../messages.ts';
import { STATUS_LABEL } from '../status.ts';

/** A local day, already of the User's time zone, without its year: “12 sept.” (spec extension §16). */
const formatDay = (day: string) =>
  new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  );

/**
 * The card of a Contact on its LinkedIn profile (spec extension §3): read only, whatever its Status;
 * its record opens in the app, in a new tab.
 */
export function ContactCardView({
  contact,
  appOrigin,
}: {
  contact: ContactCard;
  appOrigin: string;
}) {
  const stage = contact.status === 'prospecting' ? contact.stageName : null;
  return (
    <article className="flex flex-col gap-3 rounded-lg border p-4">
      <h1 className="text-lg font-semibold">
        {contact.name}
        {/* The Status says it in words just below: the star is never alone (spec UX §1). */}
        {contact.status === 'ally' && <span aria-hidden="true"> ★</span>}
      </h1>
      <p>
        <span className="inline-block rounded-full border px-2 py-0.5 text-xs text-neutral-text">
          {STATUS_LABEL[contact.status]()}
          {stage !== null && ` · ${stage}`}
        </span>
      </p>
      <div className="flex flex-col gap-1 text-sm">
        <p>{contact.organizationName ?? m.no_organization()}</p>
        {contact.jobTitle !== null && <p>{contact.jobTitle}</p>}
        <p className="text-muted-foreground">
          {contact.lastDoneInteractionOn === null
            ? m.extension_no_done_interaction()
            : m.extension_last_done_interaction({ day: formatDay(contact.lastDoneInteractionOn) })}
        </p>
      </div>
      <LinkButton
        href={`${appOrigin}/contacts/${contact.id}`}
        target="_blank"
        rel="noreferrer"
        variant="outline"
        className="self-start"
      >
        {m.open_contact()}
        <span aria-hidden="true">↗</span>
      </LinkButton>
    </article>
  );
}
