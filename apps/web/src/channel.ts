import type { Channel, CheckInChannel } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';

/** A Channel as the User reads it (CONTEXT.md, Channel). */
export const CHANNEL_LABEL: Record<Channel, () => string> = {
  email: m.channel_email,
  linkedin: m.channel_linkedin,
  phone: m.channel_phone,
  mail: m.channel_mail,
};

/** How a Check-in was done, as the User reads it (CONTEXT.md, Check-in). */
export const CHECK_IN_CHANNEL_LABEL: Record<CheckInChannel, () => string> = {
  email: m.channel_email,
  linkedin: m.channel_linkedin,
  phone: m.channel_phone,
  meeting: m.check_in_channel_meeting,
  other: m.check_in_channel_other,
};
