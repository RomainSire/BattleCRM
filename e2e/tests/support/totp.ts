import { createHmac } from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** What an authenticator app shows for `key` (base32, spaces allowed): RFC 6238, 30 s, 6 digits, SHA-1. */
export function totp(key: string): string {
  const bits = key
    .replaceAll(' ', '')
    .toUpperCase()
    .split('')
    .map((char) => BASE32.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  const secret = Buffer.from(bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac('sha1', secret).update(counter).digest();
  const offset = (hmac.at(-1) ?? 0) & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
