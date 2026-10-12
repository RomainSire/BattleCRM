import { createHash } from 'node:crypto';

/** What the database keeps of a secret only its holder knows: a link's token, a device cookie. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
