import { BaseMail } from '@adonisjs/mail'
import { TOKEN_TTL_MINUTES } from '#services/password_reset_service'

/** Locales supported for transactional emails — mirrors the frontend's `supportedLngs`. */
export const SUPPORTED_LOCALES = ['fr', 'en', 'ja'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Default locale used when the request does not carry one. */
export const DEFAULT_LOCALE: Locale = 'en'

/**
 * Per-locale copy for the reset-password email.
 * Kept inline (no i18n framework) because this is the only email the app sends.
 * `ttl` and `url` are interpolated by `prepare()`.
 * NB: handmade i18n because the ONLY place i18n is implemented on the backend side is here,
 * so using the built in i18n lib in Adonis would be overkill
 */
const translations: Record<Locale, { subject: string; html: (resetUrl: string) => string }> = {
  fr: {
    subject: 'Réinitialisation de votre mot de passe BattleCRM',
    html: (resetUrl) => `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h1 style="font-size: 20px;">Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé à réinitialiser votre mot de passe BattleCRM.</p>
        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="font-size: 14px; color: #666;">
          Ce lien est valable ${TOKEN_TTL_MINUTES} minutes. Si le bouton ne fonctionne pas,
          copiez-collez cette adresse dans votre navigateur :<br />
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #666;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
        </p>
      </div>
    `,
  },
  en: {
    subject: 'Reset your BattleCRM password',
    html: (resetUrl) => `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h1 style="font-size: 20px;">Password reset</h1>
        <p>You requested to reset your BattleCRM password.</p>
        <p>Click the button below to choose a new password:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Reset my password
          </a>
        </p>
        <p style="font-size: 14px; color: #666;">
          This link is valid for ${TOKEN_TTL_MINUTES} minutes. If the button doesn't work,
          copy and paste this address into your browser:<br />
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #666;">
          If you didn't request this, simply ignore this email.
        </p>
      </div>
    `,
  },
  ja: {
    subject: 'BattleCRM のパスワード再設定',
    html: (resetUrl) => `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h1 style="font-size: 20px;">パスワードの再設定</h1>
        <p>BattleCRM のパスワード再設定がリクエストされました。</p>
        <p>下のボタンをクリックして新しいパスワードを設定してください:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}"
             style="background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
            パスワードを再設定する
          </a>
        </p>
        <p style="font-size: 14px; color: #666;">
          このリンクは ${TOKEN_TTL_MINUTES} 分間有効です。ボタンが機能しない場合は、
          次のアドレスをブラウザにコピー＆ペーストしてください:<br />
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #666;">
          このリクエストに心当たりがない場合は、このメールを無視してください。
        </p>
      </div>
    `,
  },
}

/**
 * Email sent when a user requests a password reset.
 * Contains a single-use link pointing to the frontend reset page.
 * The locale is provided by the frontend (the backend has no UI-language context).
 */
export default class ResetPasswordNotification extends BaseMail {
  subject: string

  constructor(
    private recipient: string,
    private resetUrl: string,
    private locale: Locale = DEFAULT_LOCALE,
  ) {
    super()
    this.subject = translations[this.locale].subject
  }

  prepare() {
    this.message.to(this.recipient).html(translations[this.locale].html(this.resetUrl))
  }
}
