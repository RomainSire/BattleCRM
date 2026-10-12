import { createHash } from 'node:crypto';

import type { Logger } from 'pino';

/** Have I Been Pwned, behind an interface so that tests never reach the network. */
export type Hibp = {
  /** Rejects when the service cannot answer: the caller then refuses the password (spec stack §7). */
  isCompromised(password: string): Promise<boolean>;
};

/** k-anonymity: only the first five characters of the SHA-1 leave the API. */
export function haveIBeenPwned(fetch: typeof globalThis.fetch = globalThis.fetch): Hibp {
  return {
    async isCompromised(password) {
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
      const response = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
        // Padded answers all have the same size; a padding line counts 0.
        headers: { 'Add-Padding': 'true' },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Have I Been Pwned answered ${response.status}`);
      const suffix = hash.slice(5);
      return (await response.text()).split('\n').some((line) => {
        const [candidate, count] = line.trim().split(':');
        return candidate === suffix && count !== '0';
      });
    },
  };
}

/**
 * A new password is checked at the sign-up, at a change and at a reset (spec stack §7): resolves to why
 * it is not taken, if it is not. The union is spelled out wherever it reaches a route: the SPA's typed
 * client cannot name an alias of this module.
 */
export async function newPasswordRefusal(
  hibp: Hibp,
  logger: Logger,
  password: string,
): Promise<'password_compromised' | 'password_check_unavailable' | undefined> {
  try {
    return (await hibp.isCompromised(password)) ? 'password_compromised' : undefined;
  } catch (error) {
    // Unreachable means refused: an unchecked password never gets in.
    logger.warn(
      { error: error instanceof Error ? error.name : 'Error' },
      'password check unavailable',
    );
    return 'password_check_unavailable';
  }
}
