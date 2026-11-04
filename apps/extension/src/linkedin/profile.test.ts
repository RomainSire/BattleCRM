import { describe, expect, test } from 'vitest';

import expected from '../../test/linkedin/expected.json';
import { pageOf, PROFILES } from '../../test/linkedin/pages.ts';
import { profileName, profileUrlOf } from './profile.ts';

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
