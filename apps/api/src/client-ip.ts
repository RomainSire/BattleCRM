import { isIP, type BlockList } from 'node:net';

/**
 * The address of the client: X-Forwarded-For is believed only from a trusted proxy (Traefik),
 * which appends the address it saw as the last entry.
 */
export function resolveClientIp(
  remoteAddress: string | undefined,
  forwardedFor: string | undefined,
  trustedProxies: BlockList,
): string | undefined {
  if (!remoteAddress || !forwardedFor) return remoteAddress;
  const family = isIP(remoteAddress) === 6 ? 'ipv6' : 'ipv4';
  if (!trustedProxies.check(remoteAddress, family)) return remoteAddress;
  const forwarded = forwardedFor.split(',').at(-1)?.trim() ?? '';
  return isIP(forwarded) ? forwarded : remoteAddress;
}
