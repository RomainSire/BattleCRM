import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { Client } from 'pg';
import { z } from 'zod';

/** The Postgres of compose.e2e.yml, as its superuser: the tests only touch sign-up attempts and rate limits. */
const DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5433/battlecrm';

/** The time zone of every User the tests create: “today” is read in it. */
const TIME_ZONE = 'Europe/Paris';

export type Account = { email: string; password: string };

/**
 * A new User, signed in on `request` (and on its page): the real sign-up, whose e-mailed link is
 * replaced in the database by one the test knows. The e-mail itself is covered by the API's tests.
 */
export async function signUp(request: APIRequestContext): Promise<Account> {
  const account = {
    email: `e2e-${randomUUID()}@example.com`,
    password: randomBytes(18).toString('base64url'),
  };
  const started = await request.post('/api/signup', {
    data: { ...account, locale: 'fr', timeZone: TIME_ZONE },
  });
  expect(started.status(), await started.text()).toBe(202);

  const token = randomUUID();
  await database('update pending_signup set token_hash = $1 where email = $2', [
    createHash('sha256').update(token).digest('hex'),
    account.email,
  ]);

  const verified = await request.post('/api/signup/verify', { data: { token } });
  expect(verified.status(), await verified.text()).toBe(200);
  return account;
}

/**
 * Every test comes from the edge's address: the counters of sign-ins and codes by address (ST-15) start
 * again, as on a fresh stack, or the suite run again within 15 minutes would hit them.
 */
export async function forgetRateLimits(): Promise<void> {
  await database('delete from rate_limit');
}

async function database(query: string, values: unknown[] = []): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(query, values);
  } finally {
    await client.end();
  }
}

/**
 * What a journey starts from but does not walk through, written by the API's endpoints as the SPA would.
 */
export const seed = {
  /** The id of a Stage of the User's Funnel, by its name. */
  async stageId(request: APIRequestContext, name: string): Promise<string> {
    return idOf((await summary(request)).stages, name);
  },

  /** The id of one of the User's Organizations, by its name. */
  async organizationId(request: APIRequestContext, name: string): Promise<string> {
    return idOf((await summary(request)).organizations, name);
  },

  async positioning(request: APIRequestContext, stageId: string, label: string): Promise<string> {
    const response = await request.post('/api/positionings', {
      data: {
        stageId,
        label,
        channel: 'email',
        content: `${label} : bonjour {prénom}`,
        followUps: [{ days: 3 }],
        responseWindowDays: 10,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
    return addedId(await response.json(), 'positionings');
  },

  /** `positioningId` sent to a Contact `daysAgo` days ago: its Follow-up 1 is due 3 days later. */
  async sent(
    request: APIRequestContext,
    contactId: string,
    positioningId: string,
    daysAgo: number,
  ): Promise<void> {
    const response = await request.post(`/api/contacts/${contactId}/use-positioning`, {
      data: { positioningId, occurredOn: dayFromToday(-daysAgo) },
    });
    expect(response.status(), await response.text()).toBe(200);
  },

  async contact(
    request: APIRequestContext,
    contact: {
      name: string;
      status?: 'pool' | 'prospecting' | 'ally';
      stageId?: string;
      newOrganization?: { name: string; type: 'consultancy' | 'end_client' };
    },
  ): Promise<string> {
    const response = await request.post('/api/contacts', { data: contact });
    expect(response.status(), await response.text()).toBe(201);
    return addedId(await response.json(), 'contacts');
  },

  /** A Battle at `stageId`, its first: `championId` defends against `challengerId`. */
  async battle(
    request: APIRequestContext,
    battle: { stageId: string; championId: string; challengerId: string },
  ): Promise<void> {
    const response = await request.post('/api/battles', {
      data: {
        ...battle,
        successCriterion: 'a demandé le CV',
        target: null,
        threshold: 0.9,
        horizon: 25,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  },
};

const named = z.array(z.object({ id: z.string(), name: z.string() }));

/** What the tests read of the User's summary. */
async function summary(request: APIRequestContext) {
  const response = await request.get('/api/summary');
  expect(response.status()).toBe(200);
  return z.object({ stages: named, organizations: named }).parse(await response.json());
}

function idOf(rows: z.infer<typeof named>, name: string): string {
  const row = rows.find((candidate) => candidate.name === name);
  if (!row) throw new Error(`Nothing named “${name}” in the summary`);
  return row.id;
}

/** The id of the one row a creation's changes carry. */
function addedId(answer: unknown, rows: 'contacts' | 'positionings'): string {
  const created = z.array(z.object({ id: z.string() })).nullish();
  const { changes } = z
    .object({ changes: z.object({ contacts: created, positionings: created }) })
    .parse(answer);
  const added = changes[rows]?.[0];
  if (!added) throw new Error(`The API answered without the added row of ${rows}`);
  return added.id;
}

/** The day `offset` days from today, for the Users the tests create. */
function dayFromToday(offset: number): string {
  const day = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return day.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE });
}

/** A device that had the app already: its service worker installed, and the page under it. */
export async function installed(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

/**
 * Blocking accessibility check of the whole page (spec stack §13), with the pointer away from every
 * control and once its animations are over: a colour on its way to the theme is no colour to judge.
 * Soft: one screen's violations do not hide the next screen's; `screen` says whose they are.
 */
export async function expectNoAxeViolations(page: Page, screen: string) {
  await page.mouse.move(0, 0);
  // One that ends may let another start, as a hover that leaves.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const running = document
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
        await Promise.all(running.map((animation) => animation.finished.catch(() => undefined)));
        return running.length;
      }),
    )
    .toBe(0);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect
    .soft(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((node) => node.target.join(' ')),
      })),
      screen,
    )
    .toEqual([]);
}

/**
 * Every test starts signed in, as a User of its own: tests run in parallel without cleaning up.
 * `account` says which; a test of the screens without a session takes `test` from Playwright instead.
 */
export const test = base.extend<{ account: Account }>({
  account: [
    async ({ page }, use) => {
      await use(await signUp(page.request));
    },
    { auto: true },
  ],
});

export { expect };
