import { BaseMail } from '@adonisjs/mail'
import { TOKEN_TTL_MINUTES } from '#services/password_reset_service'

/**
 * Email sent when a user requests a password reset.
 * Contains a single-use link pointing to the frontend reset page.
 */
export default class ResetPasswordNotification extends BaseMail {
  subject = 'Réinitialisation de votre mot de passe BattleCRM'

  constructor(
    private recipient: string,
    private resetUrl: string,
  ) {
    super()
  }

  prepare() {
    this.message.to(this.recipient).html(`
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h1 style="font-size: 20px;">Réinitialisation de mot de passe</h1>
        <p>Vous avez demandé à réinitialiser votre mot de passe BattleCRM.</p>
        <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <p style="margin: 24px 0;">
          <a href="${this.resetUrl}"
             style="background: #1a1a1a; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Réinitialiser mon mot de passe
          </a>
        </p>
        <p style="font-size: 14px; color: #666;">
          Ce lien est valable ${TOKEN_TTL_MINUTES} minutes. Si le bouton ne fonctionne pas,
          copiez-collez cette adresse dans votre navigateur :<br />
          <a href="${this.resetUrl}">${this.resetUrl}</a>
        </p>
        <p style="font-size: 14px; color: #666;">
          Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.
        </p>
      </div>
    `)
  }
}
