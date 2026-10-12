import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(text: string): Buffer {
  let bits = '';
  for (const character of text.replace(/=+$/, '').toUpperCase()) {
    const value = BASE32.indexOf(character);
    if (value === -1) throw new Error(`Not base32: ${text}`);
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => Number.parseInt(byte, 2)));
}

/**
 * The code an authenticator app shows for the key of an `otpauth://` URI (RFC 6238: SHA-1, 6 digits,
 * 30 seconds), worked out apart from Better Auth. `steps` moves by whole periods.
 */
export function totpCode(uri: string, steps = 0): string {
  const key = new URL(uri).searchParams.get('secret');
  if (!key) throw new Error('The URI carries no key');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + steps));
  const mac = createHmac('sha1', base32Decode(key)).update(counter).digest();
  const offset = mac.readUInt8(mac.length - 1) & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fff_ffff) % 1_000_000).padStart(6, '0');
}

/** Six digits no clock near this one would accept. */
export function wrongTotpCode(uri: string): string {
  const near = [-2, -1, 0, 1, 2].map((steps) => totpCode(uri, steps));
  const wrong = ['000000', '111111', '222222', '333333', '444444', '555555'].find(
    (code) => !near.includes(code),
  );
  if (!wrong) throw new Error('No wrong code left');
  return wrong;
}
