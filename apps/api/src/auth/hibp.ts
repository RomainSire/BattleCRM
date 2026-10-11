import { createHash } from 'node:crypto';

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
