import { defineConfig, transports } from '@adonisjs/mail'
import env from '#start/env'

/**
 * Mail configuration — Gmail SMTP transport.
 *
 * Host/port are hardcoded to Gmail's SMTP endpoint; only the credentials
 * (dedicated Gmail account + App Password) and sender come from env.
 */
const mailConfig = defineConfig({
  default: 'smtp',

  from: {
    address: env.get('GMAIL_USER'),
    name: env.get('APP_NAME'),
  },

  mailers: {
    smtp: transports.smtp({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        type: 'login',
        user: env.get('GMAIL_USER'),
        pass: env.get('GMAIL_APP_PASSWORD'),
      },
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
