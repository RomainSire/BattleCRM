import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizeName,
  normalizePhone,
} from './normalize.ts';

/** Letters a name may carry, accented ones and other scripts included. */
const nameText = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzéèêëàâäîïôöûüçñœ-&.0123456789 '.split('')),
  minLength: 1,
});

/** The same text, written differently: its case changed, its accents dropped, spaces added or removed. */
const spellingOf = (text: string) =>
  fc
    .tuple(fc.boolean(), fc.boolean(), fc.array(fc.constantFrom(' ', '  ', '\t', ' ')))
    .map(([upper, unaccented, spaces]) => {
      let spelled = upper ? text.toUpperCase() : text;
      if (unaccented) spelled = spelled.normalize('NFD').replace(/\p{M}/gu, '');
      spelled = spelled.replaceAll(' ', '');
      // The spaces go back in anywhere, never where the text decides.
      for (const [index, space] of spaces.entries()) {
        const at = index % (spelled.length + 1);
        spelled = spelled.slice(0, at) + space + spelled.slice(at);
      }
      return spelled;
    });

describe('normalizeName: case, accents and spaces aside (ST-30)', () => {
  test('two spellings of the same name normalize alike', () => {
    fc.assert(
      fc.property(
        nameText.chain((text) => fc.tuple(spellingOf(text), spellingOf(text))),
        ([one, other]) => normalizeName(one) === normalizeName(other),
      ),
    );
  });

  test('normalizing twice changes nothing', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (text) => normalizeName(normalizeName(text)) === normalizeName(text),
      ),
    );
  });

  test('a different letter is a different name', () => {
    expect(normalizeName('Capgemini')).toBe(normalizeName('  cap GÉMINI '));
    expect(normalizeName('Capgemini')).not.toBe(normalizeName('Capgemina'));
    expect(normalizeName('Sopra Steria')).toBe('soprasteria');
  });
});

/** A LinkedIn profile path: its slug, as LinkedIn writes them. */
const profilePath = fc.stringMatching(/^[a-z0-9-]{3,30}$/).map((slug) => `/in/${slug}`);

/** The same profile, its address written in any of the ways a browser or LinkedIn shows it. */
const addressOf = (path: string) =>
  fc
    .record({
      scheme: fc.constantFrom('https://', 'http://', 'HTTPS://', ''),
      www: fc.constantFrom('www.', 'WWW.', ''),
      host: fc.constantFrom('linkedin.com', 'LinkedIn.com'),
      slashes: fc.constantFrom('', '/', '//'),
      query: fc.constantFrom('', '?originalSubdomain=fr', '?trk=public_profile&lipi=abc'),
      fragment: fc.constantFrom('', '#experience'),
      blank: fc.constantFrom('', ' ', '\n'),
    })
    .map(
      ({ scheme, www, host, slashes, query, fragment, blank }) =>
        `${blank}${scheme}${www}${host}${path}${slashes}${query}${fragment}${blank}`,
    );

describe('normalizeLinkedInUrl: https, www, final slash and parameters aside (ST-30)', () => {
  test('every way of writing the same profile normalizes alike', () => {
    fc.assert(
      fc.property(
        profilePath.chain((path) => fc.tuple(addressOf(path), addressOf(path))),
        ([one, other]) => normalizeLinkedInUrl(one) === normalizeLinkedInUrl(other),
      ),
    );
  });

  test('the normalized address is itself an address, which normalizes to itself', () => {
    fc.assert(
      fc.property(profilePath.chain(addressOf), (address) => {
        const normalized = normalizeLinkedInUrl(address);
        return normalized !== null && normalizeLinkedInUrl(normalized) === normalized;
      }),
    );
  });

  test('two profiles stay two', () => {
    fc.assert(
      fc.property(profilePath, profilePath, (one, other) => {
        fc.pre(one !== other);
        return (
          normalizeLinkedInUrl(`linkedin.com${one}`) !==
          normalizeLinkedInUrl(`linkedin.com${other}`)
        );
      }),
    );
  });

  test('it reads as an https address without www', () => {
    expect(normalizeLinkedInUrl('http://www.linkedin.com/in/jean-dupont/?trk=x')).toBe(
      'https://linkedin.com/in/jean-dupont',
    );
  });

  test('a profile is the same in any case, and on the site of any country', () => {
    expect(normalizeLinkedInUrl('https://fr.linkedin.com/in/Jean-Dupont')).toBe(
      'https://linkedin.com/in/jean-dupont',
    );
  });

  test.each([
    '',
    '   ',
    'jean dupont',
    'linkedin.com/in/jean dupont',
    'ftp://linkedin.com/in/jean',
    'https://',
    'example.com/in/jean',
    'https://notlinkedin.com/in/jean',
  ])('%j is no LinkedIn address', (text) => {
    expect(normalizeLinkedInUrl(text)).toBeNull();
  });
});

describe('normalizeEmail and normalizePhone: what tells two of them apart', () => {
  test('an e-mail address, case and spaces aside', () => {
    expect(normalizeEmail(' Jean.Dupont@Example.COM ')).toBe('jean.dupont@example.com');
  });

  test('a phone number, its digits and the sign that opens it', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe(normalizePhone('06.12.34.56.78'));
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('+33 6 12 34 56 78')).not.toBe(normalizePhone('06 12 34 56 78'));
  });

  test('normalizing twice changes nothing', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(normalizeEmail(normalizeEmail(text))).toBe(normalizeEmail(text));
        expect(normalizePhone(normalizePhone(text))).toBe(normalizePhone(text));
      }),
    );
  });
});
