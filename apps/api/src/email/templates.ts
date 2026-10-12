import { m } from '@battlecrm/i18n';
import type { Locale } from '@battlecrm/i18n/runtime';

import { html, type SafeHtml } from './html.ts';

export type { Locale };

export type RenderedEmail = { subject: string; text: string; html: string };

type Link = { label: string; url: string };

/** The single, minimal layout: a table, inline styles, one button; the text version says the same. */
function layout(
  locale: Locale,
  content: { subject: string; before: string[]; action: Link; after: (string | Link)[] },
): RenderedEmail {
  const footer = m.email_footer({}, { locale });
  const paragraph = (line: string | Link): SafeHtml =>
    typeof line === 'string'
      ? html`<p style="margin:0 0 16px">${line}</p>`
      : html`<p style="margin:0 0 16px">
          ${line.label} <a href="${line.url}" style="color:#0f766e">${line.url}</a>
        </p>`;
  const body = html`<!doctype html>
    <html lang="${locale}">
      <body
        style="margin:0;padding:24px;background:#f4f4f5;font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#18181b"
      >
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <table
                role="presentation"
                width="480"
                cellpadding="0"
                cellspacing="0"
                style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px"
              >
                <tr>
                  <td style="padding:24px">
                    <p style="margin:0 0 16px;font-weight:600">BattleCRM</p>
                    ${content.before.map(paragraph)}
                    <p style="margin:0 0 16px">
                      <a
                        href="${content.action.url}"
                        style="display:inline-block;padding:8px 14px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600"
                        >${content.action.label}</a
                      >
                    </p>
                    ${content.after.map(paragraph)}
                    <p style="margin:0;font-size:13px;color:#63636b">${footer}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;
  const textLine = (line: string | Link) =>
    typeof line === 'string' ? line : `${line.label}\n${line.url}`;
  return {
    subject: content.subject,
    text: [
      ...content.before,
      textLine(content.action),
      ...content.after.map(textLine),
      footer,
    ].join('\n\n'),
    html: body.safeHtml,
  };
}

/** Each template is `(params, locale) → { subject, text, html }`, its texts in Paraglide `email_*` (spec stack §8). */
export const templates = {
  verify_email: ({ url }: { url: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_verify_subject({}, { locale }),
      before: [m.email_verify_intro({}, { locale })],
      action: { label: m.email_verify_action({}, { locale }), url },
      after: [m.email_verify_ignore({}, { locale })],
    }),
  account_exists: (
    { signInUrl, resetUrl }: { signInUrl: string; resetUrl: string },
    locale: Locale,
  ) =>
    layout(locale, {
      subject: m.email_account_exists_subject({}, { locale }),
      before: [m.email_account_exists_intro({}, { locale })],
      action: { label: m.email_account_exists_action({}, { locale }), url: signInUrl },
      after: [
        { label: m.email_account_exists_reset({}, { locale }), url: resetUrl },
        m.email_account_exists_ignore({}, { locale }),
      ],
    }),
  password_reset_link: ({ url }: { url: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_password_reset_subject({}, { locale }),
      before: [m.email_password_reset_intro({}, { locale })],
      action: { label: m.email_password_reset_action({}, { locale }), url },
      after: [m.email_password_reset_ignore({}, { locale })],
    }),
  password_changed: ({ notMeUrl }: { notMeUrl: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_password_changed_subject({}, { locale }),
      before: [
        m.email_password_changed_intro({}, { locale }),
        m.email_password_changed_not_me({}, { locale }),
      ],
      action: { label: m.email_not_me({}, { locale }), url: notMeUrl },
      after: [],
    }),
  email_change_confirm: ({ url }: { url: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_change_confirm_subject({}, { locale }),
      before: [m.email_change_confirm_intro({}, { locale })],
      action: { label: m.email_change_confirm_action({}, { locale }), url },
      after: [m.email_change_confirm_ignore({}, { locale })],
    }),
  email_change_notice: (
    { newEmail, notMeUrl }: { newEmail: string; notMeUrl: string },
    locale: Locale,
  ) =>
    layout(locale, {
      subject: m.email_change_notice_subject({}, { locale }),
      before: [
        m.email_change_notice_intro({ email: newEmail }, { locale }),
        m.email_change_notice_not_me({}, { locale }),
      ],
      action: { label: m.email_not_me({}, { locale }), url: notMeUrl },
      after: [],
    }),
  two_factor_enabled: ({ notMeUrl }: { notMeUrl: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_two_factor_enabled_subject({}, { locale }),
      before: [
        m.email_two_factor_enabled_intro({}, { locale }),
        m.email_two_factor_not_me({}, { locale }),
      ],
      action: { label: m.email_not_me({}, { locale }), url: notMeUrl },
      after: [],
    }),
  two_factor_disabled: ({ notMeUrl }: { notMeUrl: string }, locale: Locale) =>
    layout(locale, {
      subject: m.email_two_factor_disabled_subject({}, { locale }),
      before: [
        m.email_two_factor_disabled_intro({}, { locale }),
        m.email_two_factor_not_me({}, { locale }),
      ],
      action: { label: m.email_not_me({}, { locale }), url: notMeUrl },
      after: [],
    }),
  new_device: (
    {
      browser,
      os,
      at,
      timeZone,
      notMeUrl,
    }: { browser: string | null; os: string | null; at: Date; timeZone: string; notMeUrl: string },
    locale: Locale,
  ) => {
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      timeZoneName: 'short',
    }).format(at);
    return layout(locale, {
      subject: m.email_new_device_subject({}, { locale }),
      before: [
        m.email_new_device_intro({}, { locale }),
        [
          browser ?? m.device_unknown_browser({}, { locale }),
          os ?? m.device_unknown_os({}, { locale }),
          date,
        ].join(' · '),
        m.email_new_device_not_me({}, { locale }),
      ],
      action: { label: m.email_not_me({}, { locale }), url: notMeUrl },
      after: [],
    });
  },
} satisfies Record<string, (params: never, locale: Locale) => RenderedEmail>;

export type Template = keyof typeof templates;
export type TemplateParams<T extends Template> = Parameters<(typeof templates)[T]>[0];
