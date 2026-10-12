/** The first that matches wins: every Chromium names Chrome and Safari, every iOS browser names Safari. */
const BROWSERS: [name: string, pattern: RegExp][] = [
  ['Edge', /\bEdg(?:e|A|iOS)?\//],
  ['Opera', /\bOPR\//],
  ['Firefox', /\b(?:Firefox|FxiOS)\//],
  ['Chrome', /\b(?:Chrome|CriOS|Chromium)\//],
  ['Safari', /\bSafari\//],
];

/** Android names Linux, and iOS names Mac OS X: they come first. */
const SYSTEMS: [name: string, pattern: RegExp][] = [
  ['Android', /\bAndroid\b/],
  ['iOS', /\b(?:iPhone|iPad|iPod)\b/],
  ['Windows', /\bWindows\b/],
  ['macOS', /\bMac OS X\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['Linux', /\bLinux\b/],
];

/**
 * The browser and the system a `User-Agent` claims, for “Connected devices” and the security e-mail
 * (spec UX §5.9): enough to recognise one's own devices, `null` for what it does not say.
 */
export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string | null;
  os: string | null;
} {
  const named = (candidates: [name: string, pattern: RegExp][]) =>
    candidates.find(([, pattern]) => pattern.test(userAgent ?? ''))?.[0] ?? null;
  return { browser: named(BROWSERS), os: named(SYSTEMS) };
}
