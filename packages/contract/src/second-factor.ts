/** What the authenticator app shows; anything else typed in a code field is a backup code. */
export const isTotpCode = (code: string) => /^\d{6}$/.test(code.replaceAll(/\s/g, ''));
