import { describe, expect, test } from 'vitest';

import expected from '../../test/linkedin/expected.json';
import { pageOf, SEARCHES } from '../../test/linkedin/pages.ts';
import { isSearchPage, readSearch } from './search.ts';

describe('readSearch', () => {
  test.each(SEARCHES)(
    '%s: each result, by its normalized address, and the link of its name',
    (fixture) => {
      const results = readSearch(pageOf(fixture));

      expect(
        results.map(({ profileUrl, nameLink }) => ({
          url: profileUrl,
          name: nameLink?.textContent.trim(),
        })),
      ).toEqual(expected[fixture].results);
    },
  );

  test.each(SEARCHES)('%s: the link of the name is the one in its line, a p', (fixture) => {
    for (const { nameLink } of readSearch(pageOf(fixture))) {
      expect(nameLink?.parentElement?.tagName).toBe('P');
    }
  });

  test('listitems emptied: no result, the search is unreadable', () => {
    const page = pageOf('search-people.html');
    for (const item of page.querySelectorAll('[role="listitem"]')) item.replaceChildren();

    expect(readSearch(page)).toEqual([]);
  });

  test('a result without the line of its name: still a result, with no link to put a pill after', () => {
    const page = pageOf('search-people.html');
    const [first] = page.querySelectorAll('[role="listitem"]');
    for (const line of first?.querySelectorAll('p') ?? []) line.remove();

    const [result] = readSearch(page);

    expect(result?.profileUrl).toBe('https://linkedin.com/in/membre-1');
    expect(result?.nameLink).toBeNull();
  });
});

describe('isSearchPage', () => {
  test.each(SEARCHES)('%s: a search of people', (fixture) => {
    expect(isSearchPage(expected[fixture].url)).toBe(true);
  });

  test('nowhere else', () => {
    expect(isSearchPage(expected['profile-contract-type.html'].url)).toBe(false);
    expect(isSearchPage('https://www.linkedin.com/search/results/companies/?keywords=x')).toBe(
      false,
    );
    expect(isSearchPage('https://www.linkedin.com/feed/')).toBe(false);
    expect(isSearchPage('https://example.com/search/results/people/')).toBe(false);
  });
});
