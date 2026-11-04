import { describe, expect, test } from 'vitest';

import expected from '../../test/linkedin/expected.json';
import { pageOf, PROFILES } from '../../test/linkedin/pages.ts';
import { profileName, profileUrlOf, readProfile } from './profile.ts';

describe('profileUrlOf', () => {
  test('the address of a profile, normalized, from any of its pages', () => {
    expect(
      profileUrlOf(
        'https://www.linkedin.com/in/ga%C3%ABtan-lef%C3%A8vre-b7c41e2d/overlay/contact-info/',
      ),
    ).toBe('https://linkedin.com/in/gaëtan-lefèvre-b7c41e2d');
  });

  test('no profile elsewhere on LinkedIn', () => {
    expect(profileUrlOf(expected['search-people.html'].url)).toBeNull();
    expect(profileUrlOf('https://www.linkedin.com/feed/')).toBeNull();
    expect(profileUrlOf('https://www.linkedin.com/in/')).toBeNull();
  });
});

describe('profileName', () => {
  test.each(PROFILES)('%s: the name of the page title, the h2 that shows it', (fixture) => {
    const { url, name } = expected[fixture];
    const read = profileName(pageOf(fixture), url);

    expect(read?.name).toBe(name);
    expect(read?.heading.tagName).toBe('H2');
    expect(read?.heading.textContent.trim()).toBe(name);
  });

  test('a count of notifications before the title is no part of the name', () => {
    const page = pageOf('profile-contract-type.html');
    page.title = `(3) ${page.title}`;

    expect(profileName(page, expected['profile-contract-type.html'].url)?.name).toBe(
      'Camille Durand',
    );
  });

  test('without the h2 of the name, nothing is read', () => {
    const page = pageOf('profile-contract-type.html');
    for (const heading of page.querySelectorAll('h2')) {
      if (heading.textContent.trim() === 'Camille Durand') heading.remove();
    }

    expect(profileName(page, expected['profile-contract-type.html'].url)).toBeNull();
  });

  test('a page still showing another profile is not read: no componentkey ends with the slug', () => {
    const page = pageOf('profile-contract-type.html');

    expect(profileName(page, 'https://www.linkedin.com/in/julien-moreau-482915307/')).toBeNull();
  });

  test('the slug of the page is compared once normalized: encoded or written with its accents', () => {
    const page = pageOf('profile-accented-slug.html');

    expect(profileName(page, 'https://www.linkedin.com/in/gaëtan-lefèvre-b7c41e2d')?.name).toBe(
      'Gaëtan Lefèvre',
    );
  });
});

describe('readProfile', () => {
  test.each(PROFILES)('%s: what the form is filled with', (fixture) => {
    const { url, name, jobTitle, organizationName, email, phone } = expected[fixture];

    expect(readProfile(pageOf(fixture), url)).toEqual({
      name,
      jobTitle,
      organizationName,
      email,
      phone,
    });
  });

  test('the current experience removed: no Organization, the headline for the job title', () => {
    const page = pageOf('profile-out-of-network.html');
    page.querySelector('[componentkey^="entity-collection-item"]')?.remove();

    expect(readProfile(page, expected['profile-out-of-network.html'].url)).toMatchObject({
      jobTitle: 'Ingénieur technico-commercial',
      organizationName: null,
    });
    // The headline of this page is the title of its current experience: changed, it tells them apart.
    const other = pageOf('profile-contract-type.html');
    other.querySelector('[componentkey^="entity-collection-item"]')?.remove();
    expect(readProfile(other, expected['profile-contract-type.html'].url)).toMatchObject({
      jobTitle: 'Texte 9 | Texte 10',
      organizationName: null,
    });
  });

  test('several posts in one Organization: the Organization first, then the current post', () => {
    const page = pageOf('profile-contract-type.html');
    // The second item is such a group, in the past: brought first and made current.
    const [current, group] = page.querySelectorAll('[componentkey^="entity-collection-item"]');
    if (current === undefined || group === undefined) throw new Error('No experience to change');
    for (const text of group.querySelectorAll('p')) {
      text.textContent = text.textContent.replace(
        'nov. 2023 - nov. 2024',
        'nov. 2023 - aujourd’hui',
      );
    }
    current.remove();

    expect(readProfile(page, expected['profile-contract-type.html'].url)).toMatchObject({
      jobTitle: 'Texte 161',
      organizationName: 'Texte 160',
    });
  });

  test('a contract type unknown after the Organization: rather nothing than a wrong name', () => {
    const page = pageOf('profile-out-of-network.html');
    for (const text of page.querySelectorAll('p')) {
      if (text.textContent.trim() === 'ingeo5 · CDI') text.textContent = 'ingeo5 · Contrat inconnu';
    }

    expect(readProfile(page, expected['profile-out-of-network.html'].url)).toMatchObject({
      jobTitle: 'Ingénieur technico-commercial',
      organizationName: null,
    });
  });

  test('“Coordonnées” closed: neither e-mail nor phone, though the page has a mailto link', () => {
    const page = pageOf('profile-accented-slug-contact-info.html');
    page.querySelector('dialog[open]')?.removeAttribute('open');

    expect(
      readProfile(page, expected['profile-accented-slug-contact-info.html'].url),
    ).toMatchObject({ email: null, phone: null });
  });

  test('a page still showing another profile, or without the h2 of the name: nothing read', () => {
    expect(
      readProfile(
        pageOf('profile-contract-type.html'),
        'https://www.linkedin.com/in/julien-moreau-482915307/',
      ),
    ).toBeNull();
    const page = pageOf('profile-contract-type.html');
    for (const heading of page.querySelectorAll('h2')) {
      if (heading.textContent.trim() === 'Camille Durand') heading.remove();
    }
    expect(readProfile(page, expected['profile-contract-type.html'].url)).toBeNull();
  });
});
