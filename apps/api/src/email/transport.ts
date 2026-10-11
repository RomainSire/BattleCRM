import { createTransport } from 'nodemailer';

export type EmailMessage = { to: string; subject: string; text: string; html: string };

/** The only door to the outside for e-mails: Gmail in production, a recording double in tests. */
export type EmailTransport = { send(message: EmailMessage): Promise<void> };

/**
 * Gmail's SMTP with an app password (spec stack §8). The sender is always `user`:
 * romainsire.com is under a strict DMARC at another provider and must never be the sender.
 */
export function gmailTransport({
  user,
  password,
  fromName,
}: {
  user: string;
  password: string;
  fromName: string;
}): EmailTransport {
  const transport = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass: password },
  });
  return {
    async send(message) {
      await transport.sendMail({ from: { name: fromName, address: user }, ...message });
    },
  };
}
