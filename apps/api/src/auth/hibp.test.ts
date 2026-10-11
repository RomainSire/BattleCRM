import { expect, test } from 'vitest';

import { haveIBeenPwned } from './hibp.ts';

// SHA-1 of "password": 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8.
const range = (lines: string[]) => () => Promise.resolve(new Response(lines.join('\r\n')));

test('sends only the first five characters of the SHA-1, and asks for padding', async () => {
  const requests: Request[] = [];
  const hibp = haveIBeenPwned((input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(new Response(''));
  });

  await hibp.isCompromised('password');

  expect(requests.map((request) => request.url)).toEqual([
    'https://api.pwnedpasswords.com/range/5BAA6',
  ]);
  expect(requests[0]?.headers.get('Add-Padding')).toBe('true');
});

test('a password whose suffix is listed is compromised', async () => {
  const hibp = haveIBeenPwned(
    range([
      '0018A45C4D1DEF81644B54AB7F969B88D65:1',
      '1E4C9B93F3F0682250B6CF8331B7EE68FD8:52256179',
    ]),
  );

  expect(await hibp.isCompromised('password')).toBe(true);
});

test('an unlisted suffix or a padding line is not', async () => {
  const unlisted = haveIBeenPwned(range(['0018A45C4D1DEF81644B54AB7F969B88D65:1']));
  const padding = haveIBeenPwned(range(['1E4C9B93F3F0682250B6CF8331B7EE68FD8:0']));

  expect(await unlisted.isCompromised('password')).toBe(false);
  expect(await padding.isCompromised('password')).toBe(false);
});

test('rejects when the service fails, so that the caller refuses the password', async () => {
  const down = haveIBeenPwned(() => Promise.resolve(new Response('', { status: 503 })));
  const unreachable = haveIBeenPwned(() => Promise.reject(new TypeError('fetch failed')));

  await expect(down.isCompromised('password')).rejects.toThrow('answered 503');
  await expect(unreachable.isCompromised('password')).rejects.toThrow('fetch failed');
});
