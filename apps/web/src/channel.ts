import type { Channel } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

/** A Channel as the User reads it (CONTEXT.md, Channel). */
export const CHANNEL_LABEL: Record<Channel, () => string> = {
  email: m.channel_email,
  linkedin: m.channel_linkedin,
  phone: m.channel_phone,
  mail: m.channel_mail,
};
