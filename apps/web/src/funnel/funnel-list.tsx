import { funnelOf, isFollowUpDueIn, targetOf } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { Link } from '@tanstack/react-router';

import { useLocale } from '../i18n.ts';
import { organizationOf, type Summary } from '../summary.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import { targetText } from '../contacts/organization-field.tsx';
import { CardActions, nextActionText, type Card, type OpenGesture } from './next-action.tsx';

/**
 * The Funnel on a narrow screen (spec UX §5.2): a list per Stage, by urgency, without drag nor table.
 * A Contact changes Stage from its record, which its name opens; the shortcuts are those of Today.
 */
export function FunnelList({
  cards,
  summary,
  today,
  onOpen,
}: {
  cards: Card[];
  summary: Summary;
  today: string;
  onOpen: OpenGesture;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-5">
      {funnelOf(summary.stages).map((stage) => {
        const inStage = cards.filter(({ contact }) => contact.stageId === stage.id);
        const headingId = `funnel-list-${stage.id}`;
        return (
          <section key={stage.id} aria-labelledby={headingId} className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id={headingId} className="font-semibold">
                {stage.name}
              </h2>
              {stage.aim && <p className="text-xs text-muted-foreground">{stage.aim}</p>}
              <p className="text-xs text-muted-foreground tabular-nums">
                {m.funnel_stage_contacts({ count: inStage.length })}
              </p>
            </div>
            {inStage.length > 0 && (
              <ul aria-labelledby={headingId} className="flex flex-col gap-2">
                {inStage.map((card) => {
                  const { contact, agenda } = card;
                  const organization = organizationOf(contact, summary);
                  return (
                    <li
                      key={contact.id}
                      className="flex flex-col gap-1.5 rounded-card border bg-background p-3"
                    >
                      <Link
                        to="/contacts/$contactId"
                        params={{ contactId: contact.id }}
                        className="flex min-h-11 items-center self-start font-medium underline-offset-4 focus-ring hover:underline"
                      >
                        <ContactName contact={contact} />
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {organization?.name ?? m.no_organization()} ·{' '}
                        {targetText(targetOf(organization))}
                      </span>
                      <p
                        className={cn(
                          'text-xs',
                          isFollowUpDueIn(agenda)
                            ? 'font-medium text-overdue'
                            : 'text-neutral-text',
                        )}
                      >
                        {nextActionText(card, summary, today, locale)}
                      </p>
                      <CardActions
                        card={card}
                        summary={summary}
                        open={(search) => onOpen(contact.id, search)}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
