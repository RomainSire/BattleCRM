import type { Logger } from 'pino';

import { failureReason, type Alert } from '../alert.ts';
import type { InFlight } from '../in-flight.ts';
import {
  templates,
  type Locale,
  type RenderedEmail,
  type Template,
  type TemplateParams,
} from './templates.ts';
import type { EmailTransport } from './transport.ts';

export type SendEmail = <T extends Template>(
  to: string,
  template: T,
  params: TemplateParams<T>,
  locale: Locale,
) => void;

/** What a log line may say of an address: enough to recognise it, not to read it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Sends after the commit and never awaited: a neutral answer depends neither on the delay nor
 * on the success of the SMTP. No queue, no retry: a failure is logged and alerts (spec stack §8).
 */
export function createEmailSender({
  transport,
  logger,
  alert,
  inFlight,
}: {
  transport: EmailTransport;
  logger: Logger;
  alert: Alert;
  inFlight: InFlight;
}): SendEmail {
  return (to, template, params, locale) => {
    // The template and its params are tied by the signature; TypeScript cannot follow that through the lookup.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const render = templates[template] as (params: unknown, locale: Locale) => RenderedEmail;
    inFlight.track(
      Promise.resolve()
        .then(() => transport.send({ to, ...render(params, locale) }))
        .catch((error: unknown) => {
          // Neither the address nor the error message, which may quote it.
          logger.error(
            { template, to: maskEmail(to), error: error instanceof Error ? error.name : 'Error' },
            'email failed',
          );
          alert.down(failureReason(error, `email ${template}`));
        }),
    );
  };
}
