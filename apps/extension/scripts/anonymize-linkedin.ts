/**
 * Turns the LinkedIn pages saved in `.private/linkedin/` into anonymised test fixtures for the
 * reading code, in `apps/extension/test/linkedin/`. The real pages never leave `.private/`.
 *
 * Whitelist, not blacklist: whatever the script does not know is removed or replaced, so what
 * nobody noticed cannot leak.
 * - removed: scripts, styles, images, SVG, frames, templates, comments, all of `<head>` but `<title>`;
 * - attributes: all dropped but `componentkey`, `data-testid`, `role`, `href`, `open`, `lang`, `dir`;
 *   identifiers in them (profile slugs, `ACoA…`, UUIDs, long numbers) get stable fake ones;
 * - texts: every text is replaced by a stable fake one (`Texte 12`), except LinkedIn labels listed
 *   in `LABELS`, dates and durations, and values the configuration maps to invented ones;
 * - links: `/in/`, `/company/`, `/school/` and `mailto:` get fake targets (an accented or `%xx`
 *   slug keeps that shape), every other link becomes `#`.
 * The script then fails if any word, slug or identifier of the original page is still there.
 *
 * The configuration is `.private/linkedin/anonymize.json` (git-ignored: it holds the real values).
 * Run from the repository root: `node apps/extension/scripts/anonymize-linkedin.ts`, then read the
 * output before committing it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

interface Profile {
  id: string;
  /** The real slug of the profile and its invented one. */
  slug: [string, string];
  /** Real text (a whole text, or a part between ` · ` or ` | `) → invented one. */
  replace: Record<string, string>;
}

interface ExpectedProfile {
  name: string;
  jobTitle: string | null;
  organizationName: string | null;
  email: string | null;
  phone: string | null;
}

interface Page {
  source: string;
  output: string;
  profile?: string;
  /** The page URL as the browser shows it, already invented. */
  url: string;
  /** What the reading code must find, in real values: written out with the invented ones. */
  expected?: ExpectedProfile;
}

interface Config {
  outputDir: string;
  profiles: Profile[];
  pages: Page[];
}

/** LinkedIn's own labels (French interface), kept as they are: they carry nothing personal. */
const LABELS = [
  // Profile
  'LinkedIn',
  'Expérience',
  'Formation',
  'Coordonnées',
  'Infos',
  'Activité',
  'Compétences',
  'Langues',
  'Centres d’intérêt',
  'Tout afficher',
  'Message',
  'Se connecter',
  'Suivre',
  'Plus',
  'plus',
  '…',
  '· 1er',
  '· 2e',
  '· 3e',
  '· 3e et +',
  '• 1er',
  '• 2e',
  '• 3e',
  '• 3e et +',
  // Contract and workplace types, after ` · `
  'CDI',
  'CDD',
  'Stage',
  'Contrat en alternance',
  'Contrat en apprentissage',
  'Temps plein',
  'Temps partiel',
  'Freelance',
  'Indépendant',
  'Intérim',
  'Hybride',
  'Sur site',
  'À distance',
  // “Coordonnées” window
  'Téléphone',
  '(Mobile)',
  '(Domicile)',
  '(Travail)',
  'Adresse',
  'E-mail',
  'Anniversaire',
  'Connecté(e) depuis',
  'Site web',
  // People search
  'Recherche',
  'Poste actuel :',
  'et',
  'est une relation que vous avez en commun',
  'sont des relations que vous avez en commun',
  // Navigation
  'Accueil',
  'Réseau',
  'Emplois',
  'Messagerie',
  'Notifications',
  'Vous',
  'Pour les entreprises',
  'Personnes que vous pourriez connaître',
  'Vous aimerez peut-être',
  'Plus de profils pour vous',
];

/** Words the fakes and the kept dates bring: a replaced text may share them without leaking. */
const STRUCTURAL_WORDS = [
  'texte',
  'aujourd’hui',
  'mois',
  'janv',
  'févr',
  'mars',
  'juin',
  'juil',
  'août',
  'sept',
];

interface Input {
  html: string;
  slugs: [string, string][];
  replace: [string, string][];
  labels: string[];
}

interface Output {
  html: string;
  /** Original texts replaced by fakes, and original identifiers: none may remain. */
  replacedTexts: string[];
  replacedIds: string[];
}

/** Runs in the browser: the same `DOMParser` as the tests. Self-contained on purpose. */
function anonymize({ html, slugs, replace, labels }: Input): Output {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const replacedTexts = new Set<string>();
  const replacedIds = new Set<string>();

  doc
    .querySelectorAll(
      'script, style, link, meta, base, svg, img, picture, video, audio, source, iframe, frame, object, embed, canvas, noscript, template',
    )
    .forEach((element) => element.remove());
  const titles = [...doc.head.querySelectorAll('title')];
  doc.head.replaceChildren(...titles.slice(0, 1));
  const comments = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  const commentNodes: Node[] = [];
  while (comments.nextNode()) commentNodes.push(comments.currentNode);
  commentNodes.forEach((node) => node.parentNode?.removeChild(node));

  /** One stable fake per real value, made by `make` from a counter. */
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- `anonymize` runs in the browser: it must be self-contained.
  const fakes = (make: (n: number, real: string) => string) => {
    const map = new Map<string, string>();
    return (real: string) => {
      let fake = map.get(real);
      if (fake === undefined) {
        fake = make(map.size + 1, real);
        map.set(real, fake);
      }
      return fake;
    };
  };
  const nonAscii = /[^ -~]/;
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- `anonymize` runs in the browser: it must be self-contained.
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value).normalize('NFC');
    } catch {
      return value.normalize('NFC');
    }
  };

  const slugMap = new Map(slugs.map(([real, fake]) => [real.normalize('NFC'), fake]));
  let otherSlugs = 0;
  const fakeSlug = (real: string) => {
    replacedIds.add(real);
    let fake = slugMap.get(real);
    if (fake === undefined) {
      otherSlugs += 1;
      fake = `${nonAscii.test(real) ? 'membré' : 'membre'}-${otherSlugs}`;
      slugMap.set(real, fake);
    }
    return fake;
  };
  const fakeOrganization = fakes((n, real) =>
    /^\d+$/.test(real) ? String(10_000_000 + n) : `organisation-${n}`,
  );
  const fakeSchool = fakes((n, real) =>
    /^\d+$/.test(real) ? String(20_000_000 + n) : `ecole-${n}`,
  );
  const fakeEmail = fakes((n) => `adresse-${n}@exemple.fr`);
  const fakeText = fakes((n) => `Texte ${n}`);
  /** `n` written in letters, so that the number rule below never rewrites a fake again. */
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- `anonymize` runs in the browser: it must be self-contained.
  const letters = (n: number, length: number) => {
    let out = '';
    for (let rest = n; rest > 0; rest = Math.floor(rest / 26))
      out = String.fromCharCode(97 + (rest % 26)) + out;
    return out.padStart(length, 'a');
  };
  const fakeMemberId = fakes((n) => `ACoAAFAKE${letters(n, 30)}`);
  const fakeUuid = fakes((n) => `aaaaaaaa-aaaa-4aaa-8aaa-${n.toString(16).padStart(12, 'a')}`);
  const fakeToken = fakes((n) => `FAKE${letters(n, 39)}`);
  const fakeNumber = fakes((n, real) => String(n).padStart(real.length, '9'));
  const replaceMap = new Map(replace);

  // First pass: every profile slug of the page, to find them again inside keys and texts.
  const profilePath = /^(?:https?:\/\/(?:[a-z]+\.)?linkedin\.com)?\/in\/([^/?#]+)(\/[^?#]*)?/;
  for (const link of doc.querySelectorAll('[href]')) {
    const match = profilePath.exec(link.getAttribute('href') ?? '');
    if (match) fakeSlug(decode(match[1]!));
  }
  const textProfile = /^((?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/)([^/\s]+)(\/?)$/;
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = textProfile.exec((node.textContent ?? '').trim());
    if (match) fakeSlug(decode(match[2]!));
  }
  const knownSlugs = [...slugMap.keys()].toSorted((a, b) => b.length - a.length);

  const rewriteKey = (value: string) => {
    // Slugs become markers first, so that the rules below never touch the digits of a fake slug.
    let key = value.normalize('NFC');
    knownSlugs.forEach((slug, index) => {
      if (key.includes(slug)) key = key.split(slug).join(`\uE000${index}\uE000`);
    });
    return key
      .replace(/ACoA[A-Za-z0-9_-]{35}/g, (id) => (replacedIds.add(id), fakeMemberId(id)))
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        (id) => (replacedIds.add(id), fakeUuid(id)),
      )
      .replace(
        /(update-card-focus)([A-Za-z0-9_-]+?)(FeedType)/g,
        (_, start: string, id: string, end: string) => {
          replacedIds.add(id);
          return start + fakeToken(id) + end;
        },
      )
      .replace(/\d{5,}/g, (id) => (replacedIds.add(id), fakeNumber(id)))
      .replace(/\uE000(\d+)\uE000/g, (_, index: string) => fakeSlug(knownSlugs[Number(index)]!));
  };

  const rewriteHref = (href: string) => {
    if (href.startsWith('mailto:')) {
      const address = decode(href.slice('mailto:'.length).split('?')[0]!);
      replacedIds.add(address);
      return `mailto:${replaceMap.get(address) ?? fakeEmail(address)}`;
    }
    const profile = profilePath.exec(href);
    if (profile) {
      const raw = profile[1]!;
      const fake = fakeSlug(decode(raw));
      const rest = profile[2] && /^[a-z/-]*$/.test(profile[2]) ? profile[2] : '/';
      return `https://www.linkedin.com/in/${raw.includes('%') ? encodeURIComponent(fake) : fake}${rest}`;
    }
    const page = /^(?:https?:\/\/(?:[a-z]+\.)?linkedin\.com)?\/(company|school)\/([^/?#]+)/.exec(
      href,
    );
    if (page) {
      const real = decode(page[2]!);
      replacedIds.add(real);
      return `https://www.linkedin.com/${page[1]}/${page[1] === 'company' ? fakeOrganization(real) : fakeSchool(real)}/`;
    }
    return '#';
  };

  const labelSet = new Set(labels);
  const month =
    '(?:janv\\.|févr\\.|mars|avr\\.|mai|juin|juil\\.|août|sept\\.|oct\\.|nov\\.|déc\\.)';
  const date = new RegExp(`^(?:${month} )?\\d{4}(?: - (?:(?:${month} )?\\d{4}|aujourd’hui))?$`);
  const duration = /^(?:\d+ ans?)?(?: ?\d+ mois)?$/;

  const rewriteSegment = (segment: string): string => {
    const counter = /^(\(\d+\) )(.+)$/.exec(segment);
    if (counter) return counter[1]! + rewriteSegment(counter[2]!);
    const replaced = replaceMap.get(segment);
    if (replaced !== undefined) {
      replacedTexts.add(segment);
      return replaced;
    }
    if (labelSet.has(segment) || date.test(segment) || duration.test(segment)) return segment;
    // Punctuation, emoji and small counts carry nothing personal.
    if (!/\p{L}/u.test(segment) && !/\d{5,}/.test(segment)) return segment;
    replacedTexts.add(segment);
    return fakeText(segment);
  };

  const rewriteText = (text: string) => {
    const profile = textProfile.exec(text);
    if (profile) return profile[1]! + fakeSlug(decode(profile[2]!)) + profile[3]!;
    return text
      .split(/( · | \| )/)
      .map((part, index) => (index % 2 === 1 ? part : rewriteSegment(part)))
      .join('');
  };

  const texts = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = texts.nextNode(); node; node = texts.nextNode()) {
    const data = node.textContent ?? '';
    if (!/\S/.test(data)) continue;
    const lead = /^\s*/.exec(data)![0];
    const trail = /\s*$/.exec(data)![0];
    node.textContent = lead + rewriteText(data.trim().replace(/\s+/g, ' ')) + trail;
  }

  const kept = new Set(['componentkey', 'data-testid', 'role', 'href', 'open', 'lang', 'dir']);
  for (const element of doc.querySelectorAll('*')) {
    for (const name of element.getAttributeNames()) {
      const value = element.getAttribute(name) ?? '';
      if (!kept.has(name)) element.removeAttribute(name);
      else if (name === 'componentkey' || name === 'data-testid')
        element.setAttribute(name, rewriteKey(value));
      else if (name === 'href') element.setAttribute(name, rewriteHref(value));
    }
  }

  return {
    html: `<!doctype html>\n${doc.documentElement.outerHTML}\n`,
    replacedTexts: [...replacedTexts],
    replacedIds: [...replacedIds],
  };
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const words = (value: string) => fold(value).match(/\p{L}[\p{L}'’-]{3,}/gu) ?? [];

/** Fails when anything of the original page is still in the fixture. */
function guard(page: Page, result: Output, profile: Profile | undefined) {
  let decoded = result.html;
  try {
    decoded = decodeURIComponent(result.html.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  } catch {
    // Keep the raw text: the identifiers are searched in it as well.
  }
  const haystack = fold(`${result.html}\n${decoded}`);
  const leaks = new Set<string>();

  const forbidden = [...result.replacedIds, ...Object.keys(profile?.replace ?? {})];
  if (profile) forbidden.push(profile.slug[0]);
  for (const value of forbidden) {
    if (value.length >= 4 && haystack.includes(fold(value))) leaks.add(value);
  }

  const allowed = new Set([
    ...LABELS.flatMap(words),
    ...Object.values(profile?.replace ?? {}).flatMap(words),
    ...STRUCTURAL_WORDS.map(fold),
  ]);
  // Attributes are covered by the identifiers above: LinkedIn's keys are full of English words.
  const outputWords = new Set(words(result.html.replace(/<[^>]*>/g, ' ')));
  for (const word of new Set(result.replacedTexts.flatMap(words))) {
    if (!allowed.has(word) && outputWords.has(word)) leaks.add(word);
  }

  if (leaks.size > 0) {
    throw new Error(
      `${page.output}: ${leaks.size} original value(s) still in the fixture: ${[...leaks].join(', ')}`,
    );
  }
}

const configPath = process.argv[2] ?? '.private/linkedin/anonymize.json';
const config: Config = JSON.parse(readFileSync(configPath, 'utf8'));
mkdirSync(config.outputDir, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage();
const FIELDS = ['name', 'jobTitle', 'organizationName', 'email', 'phone'] as const;
const expected: Record<string, Record<string, string | null>> = {};

try {
  for (const page of config.pages) {
    const profile = config.profiles.find((candidate) => candidate.id === page.profile);
    if (page.profile && !profile)
      throw new Error(`${page.output}: unknown profile ${page.profile}`);
    const result = await tab.evaluate(anonymize, {
      html: readFileSync(page.source, 'utf8'),
      slugs: profile ? [profile.slug] : [],
      replace: Object.entries(profile?.replace ?? {}),
      labels: LABELS,
    });
    guard(page, result, profile);
    writeFileSync(join(config.outputDir, page.output), result.html);

    const entry: Record<string, string | null> = { url: page.url };
    for (const field of page.expected ? FIELDS : []) {
      const real = page.expected?.[field] ?? null;
      const fake = real === null ? null : profile?.replace[real];
      if (fake === undefined)
        throw new Error(`${page.output}: no invented value for the expected ${field}`);
      entry[field] = fake;
    }
    expected[page.output] = entry;
    console.log(`${page.output}: ${Math.round(result.html.length / 1024)} kB`);
  }
  writeFileSync(join(config.outputDir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`);
} finally {
  await browser.close();
}
