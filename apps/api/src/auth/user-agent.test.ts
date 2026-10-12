import { expect, test } from 'vitest';

import { describeUserAgent } from './user-agent.ts';

test.each([
  [
    'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
    { browser: 'Firefox', os: 'Linux' },
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    { browser: 'Chrome', os: 'Windows' },
  ],
  [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
    { browser: 'Edge', os: 'Windows' },
  ],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
    { browser: 'Safari', os: 'macOS' },
  ],
  [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
    { browser: 'Opera', os: 'macOS' },
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    { browser: 'Safari', os: 'iOS' },
  ],
  [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
    { browser: 'Chrome', os: 'iOS' },
  ],
  [
    'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
    { browser: 'Firefox', os: 'iOS' },
  ],
  [
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    { browser: 'Chrome', os: 'Android' },
  ],
  [
    'Mozilla/5.0 (Android 15; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0',
    { browser: 'Firefox', os: 'Android' },
  ],
  [
    'Mozilla/5.0 (X11; CrOS x86_64 16328.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    { browser: 'Chrome', os: 'ChromeOS' },
  ],
  ['curl/8.14.1', { browser: null, os: null }],
  ['', { browser: null, os: null }],
])('%s', (userAgent, expected) => {
  expect(describeUserAgent(userAgent)).toEqual(expected);
});

test('no user agent at all names nothing', () => {
  expect(describeUserAgent(null)).toEqual({ browser: null, os: null });
});
