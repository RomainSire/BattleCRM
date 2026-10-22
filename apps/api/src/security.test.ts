import { randomUUID } from 'node:crypto';

import { battleTrials } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../test/app.ts';
import { closeBattle, openBattle } from '../test/factories/battle.ts';
import {
  addContact,
  changeStage,
  editContact,
  revealAssignment,
  scheduleFollowUp,
  usePositioning,
} from '../test/factories/contact.ts';
import {
  SHORT_EMAIL,
  attachFile,
  createPositioning,
  fileOf,
  positioningGesture,
  positioningOf,
  stageIdsOf,
} from '../test/factories/positioning.ts';
import { makeUser } from '../test/factories/user.ts';
import { postFile, postJson } from '../test/http.ts';
import { withUser } from './db/index.ts';

// Generated from the database and from the app themselves (spec stack §13): a new table or a new
// route is covered the day it is written, and fails here until it follows the rules.

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** An open Battle of a User, at the Stage of its first Positioning. */
async function battleOf(harness: Harness, user: User) {
  const { positioning } = await positioningOf(harness, user);
  const { positioning: challenger } = await createPositioning(harness, user, positioning.stageId);
  const { battle } = await openBattle(harness, user, {
    stageId: positioning.stageId,
    championId: positioning.id,
    challengerId: challenger.id,
  });
  return battle;
}

/** Read before the User is known (ADR 0010): the only tables outside row level security, on purpose. */
const AUTH_TABLES = [
  'account',
  'known_device',
  'login_attempt',
  'pending_signup',
  'rate_limit',
  'session',
  'two_factor',
  'two_factor_recovery',
  'user',
  'verification',
];

/** The policy every business table carries (ADR 0009), as Postgres writes it back. */
const ISOLATION = "(user_id = (current_setting('app.user_id'::text))::uuid)";

/** The catalogue is no business data: any User may read it. */
const catalogue = async <Row extends Record<string, unknown>>(query: ReturnType<typeof sql>) =>
  (await withUser(randomUUID(), (tx) => tx.execute<Row>(query))).rows;

const tables = () =>
  catalogue<{
    name: string;
    enabled: boolean;
    forced: boolean;
    user_id_required: boolean;
    policies: { name: string; command: string; using: string | null; check: string | null }[];
  }>(sql`
    select c.relname as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
      exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'user_id' and a.attnotnull and not a.attisdropped
      ) as user_id_required,
      coalesce((
        select json_agg(json_build_object(
          'name', p.polname, 'command', p.polcmd,
          'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)
        ))
        from pg_policy p where p.polrelid = c.oid and p.polpermissive
      ), '[]'::json) as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);

/** Every table but the auth ones, and the probe of the test harness. */
const businessTables = async () =>
  (await tables()).filter(({ name }) => !AUTH_TABLES.includes(name) && name !== 'rls_probe');

describe('catalogue', () => {
  test('only the auth tables sit outside row level security', async () => {
    const outside = (await tables()).filter((table) => !table.enabled).map(({ name }) => name);

    expect(outside).toEqual(AUTH_TABLES);
  });

  test('every business table is under forced row level security, by its user_id', async () => {
    const business = await businessTables();
    expect(business.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'contact',
        'effective_activity_goal',
        'effective_entry_goal',
        'follow_up',
        'gesture',
        'interaction',
        'attachment_blob',
        'positioning_attachment',
        'organization',
        'stage',
        'stage_change',
        'status_change',
      ]),
    );

    for (const table of business) {
      expect(table, `table ${table.name}`).toEqual({
        name: table.name,
        enabled: true,
        forced: true,
        user_id_required: true,
        policies: [{ name: 'user_isolation', command: '*', using: ISOLATION, check: ISOLATION }],
      });
    }
  });

  test('a foreign key between business tables is composite: it carries the user_id on both sides', async () => {
    const foreignKeys = await catalogue<{ name: string; columns: string[]; referenced: string[] }>(
      sql`
        select k.conname as name,
          array(select a.attname::text from pg_attribute a
                where a.attrelid = k.conrelid and a.attnum = any(k.conkey)) as columns,
          array(select a.attname::text from pg_attribute a
                where a.attrelid = k.confrelid and a.attnum = any(k.confkey)) as referenced
        from pg_constraint k
          join pg_class target on target.oid = k.confrelid
          join pg_namespace n on n.oid = target.relnamespace
        where k.contype = 'f' and n.nspname = 'public' and target.relrowsecurity
      `,
    );
    expect(foreignKeys.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'interaction_contact_fk',
        'gesture_contact_fk',
        'contact_stage_fk',
        'contact_organization_fk',
        'status_change_contact_fk',
        'status_change_interaction_fk',
        'status_change_stage_fk',
        'follow_up_contact_fk',
        'follow_up_interaction_fk',
        'positioning_attachment_blob_fk',
      ]),
    );

    for (const { name, columns, referenced } of foreignKeys) {
      expect(columns, `on ${name}`).toContain('user_id');
      expect(referenced, `on ${name}`).toContain('user_id');
    }
  });

  test('no business column takes its value from the clock of the database', async () => {
    const defaults = await catalogue<{ column: string; value: string }>(sql`
      select c.relname || '.' || a.attname as column, pg_get_expr(d.adbin, d.adrelid) as value
      from pg_attrdef d
        join pg_class c on c.oid = d.adrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where n.nspname = 'public' and c.relrowsecurity
    `);

    expect(
      defaults.filter(({ value }) => /now\(\)|current_|clock_timestamp|localtime/i.test(value)),
    ).toEqual([]);
  });
});

test('a query that forgot its filter only sees the rows of its User, in every business table', async () => {
  // Each Assignment settles a tie between the two Positionings.
  const harness = testApp({}, { chances: [0, 0] });
  const alice = await makeUser(harness);
  const bob = await makeUser(harness);
  // Each User writes in every business table: a new one fails here until a gesture fills it.
  for (const user of [alice, bob]) {
    const { contact } = await addContact(harness, user, 'Jean Dupont', {
      status: 'prospecting',
      newOrganization: { name: 'Capgemini', type: 'consultancy' },
    });
    await scheduleFollowUp(harness, user, contact.id, { dueOn: '2026-01-08' });
    await postJson(harness.app, '/api/settings', { activityGoal: 2, entryGoal: 6 }, user.cookie);
    const { positioning } = await positioningOf(harness, user);
    await attachFile(harness, user, positioning.id);
    const { positioning: challenger } = await createPositioning(harness, user, positioning.stageId);
    await openBattle(harness, user, {
      stageId: positioning.stageId,
      championId: positioning.id,
      challengerId: challenger.id,
    });
    const { assignment } = await revealAssignment(harness, user, contact.id);
    if (!assignment) throw new Error('No Assignment revealed');
    await usePositioning(harness, user, contact.id, {
      positioningId: assignment.positioningId,
      occurredOn: '2026-01-05',
    });
    // Its Follow-up moved during the Trial: a deviation traced on it.
    await scheduleFollowUp(harness, user, contact.id, { dueOn: '2026-01-20' });
    // Another Contact moves on to the next Stage.
    const { contact: moving } = await addContact(harness, user, 'Paul', { status: 'prospecting' });
    const [, next = ''] = await stageIdsOf(harness, user);
    await changeStage(harness, user, moving.id, { stageId: next });
  }

  for (const { name } of await businessTables()) {
    const rows = await withUser(
      bob.userId,
      async (tx) =>
        (await tx.execute<{ user_id: string }>(sql`select user_id from ${sql.identifier(name)}`))
          .rows,
    );

    expect(rows.length, `${name} has no row to prove anything`).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.user_id)), `on ${name}`).toEqual(new Set([bob.userId]));
  }
});

/** An Organization of the User, created with a Contact of its own. */
async function organizationOf(harness: Harness, user: User, name = 'Acme') {
  const { organization } = await addContact(harness, user, `Contact of ${name}`, {
    newOrganization: { name, type: 'consultancy' },
  });
  if (!organization) throw new Error('organizationOf: no Organization was created');
  return organization.id;
}

const getJson = async (harness: Harness, user: User, path: string): Promise<unknown> =>
  (await harness.app.request(path, { headers: { Cookie: user.cookie } })).json();

/**
 * For each route that names a row by its id: a row of Alice, what Alice has, which a request of Bob
 * must neither change nor read, and a body the route would accept, if it takes one: JSON, or a file.
 */
const CROSS_ACCESS: Record<
  string,
  (
    harness: Harness,
    alice: User,
  ) => Promise<{ id: string; state: () => Promise<unknown>; body?: object | File }>
> = {
  'POST /api/gestures/:id/undo': async (harness, alice) => {
    const { undoToken } = await addContact(harness, alice);
    return { id: undoToken, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/contacts/:id/edit': async (harness, alice) => {
    const { contact } = await addContact(harness, alice);
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { name: 'Bob was here' },
    };
  },
  'POST /api/contacts/:id/change-status': async (harness, alice) => {
    const { contact } = await addContact(harness, alice);
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { status: 'archived' },
    };
  },
  'POST /api/contacts/:id/schedule-follow-up': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { dueOn: '2026-01-08' },
    };
  },
  'POST /api/contacts/:id/cancel-follow-up': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    await scheduleFollowUp(harness, alice, contact.id, { dueOn: '2026-01-08' });
    return { id: contact.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/contacts/:id/follow-up': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    await scheduleFollowUp(harness, alice, contact.id, { dueOn: '2026-01-08' });
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { occurredOn: '2026-01-05' },
    };
  },
  'POST /api/contacts/:id/note-interaction': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { kind: 'call', occurredOn: '2026-01-05' },
    };
  },
  'POST /api/contacts/:id/record-reply': async (harness, alice) => {
    const { contact } = await addContact(harness, alice);
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { occurredOn: '2026-01-05', channel: 'email', status: 'ally' },
    };
  },
  'POST /api/contacts/:id/use-positioning': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    const { positioning } = await positioningOf(harness, alice);
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { positioningId: positioning.id, occurredOn: '2026-01-05' },
    };
  },
  'POST /api/contacts/:id/reveal-assignment': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    const { positioning } = await positioningOf(harness, alice);
    const { positioning: challenger } = await createPositioning(
      harness,
      alice,
      positioning.stageId,
    );
    await openBattle(harness, alice, {
      stageId: positioning.stageId,
      championId: positioning.id,
      challengerId: challenger.id,
    });
    return { id: contact.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/contacts/:id/settle-trial': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    const { positioning } = await positioningOf(harness, alice);
    const { positioning: challenger } = await createPositioning(
      harness,
      alice,
      positioning.stageId,
    );
    await openBattle(harness, alice, {
      stageId: positioning.stageId,
      championId: positioning.id,
      challengerId: challenger.id,
    });
    const { assignment } = await revealAssignment(harness, alice, contact.id);
    if (!assignment) throw new Error('No Assignment revealed');
    await usePositioning(harness, alice, contact.id, {
      positioningId: assignment.positioningId,
      occurredOn: '2026-01-05',
    });
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { outcome: 'no_result' },
    };
  },
  'POST /api/contacts/:id/change-stage': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    const [, next = ''] = await stageIdsOf(harness, alice);
    return {
      id: contact.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { stageId: next },
    };
  },
  'POST /api/trials/:id/change-outcome': async (harness, alice) => {
    const { contact } = await addContact(harness, alice, 'Jean Dupont', { status: 'prospecting' });
    const { positioning } = await positioningOf(harness, alice);
    const { positioning: challenger } = await createPositioning(
      harness,
      alice,
      positioning.stageId,
    );
    const { battle } = await openBattle(harness, alice, {
      stageId: positioning.stageId,
      championId: positioning.id,
      challengerId: challenger.id,
    });
    const { assignment } = await revealAssignment(harness, alice, contact.id);
    if (!assignment) throw new Error('No Assignment revealed');
    await usePositioning(harness, alice, contact.id, {
      positioningId: assignment.positioningId,
      occurredOn: '2026-01-05',
    });
    const read = await harness.app.request(`/api/battles/${battle.id}/trials`, {
      headers: { Cookie: alice.cookie },
    });
    const { trials } = battleTrials.parse(await read.json());
    return {
      id: trials[0]?.id ?? '',
      state: () => getJson(harness, alice, `/api/battles/${battle.id}/trials`),
      body: { outcome: 'success' },
    };
  },
  'GET /api/battles/:id/trials': async (harness, alice) => {
    const battle = await battleOf(harness, alice);
    return { id: battle.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/battles/:id/close': async (harness, alice) => {
    const battle = await battleOf(harness, alice);
    return {
      id: battle.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { verdict: 'abandoned' },
    };
  },
  'POST /api/battles/:id/takeaway': async (harness, alice) => {
    const battle = await battleOf(harness, alice);
    await closeBattle(harness, alice, battle.id, { verdict: 'abandoned', takeaway: 'Alice' });
    return {
      id: battle.id,
      state: () => getJson(harness, alice, '/api/summary'),
      body: { takeaway: 'Bob was here' },
    };
  },
  'GET /api/contacts/:id/record': async (harness, alice) => {
    const { contact } = await addContact(harness, alice);
    return { id: contact.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/organizations/:id/rename': async (harness, alice) => ({
    id: await organizationOf(harness, alice),
    state: () => getJson(harness, alice, '/api/summary'),
    body: { name: 'Bob was here' },
  }),
  'POST /api/organizations/:id/change-type': async (harness, alice) => ({
    id: await organizationOf(harness, alice),
    state: () => getJson(harness, alice, '/api/summary'),
    body: { type: 'end_client' },
  }),
  'POST /api/organizations/:id/merge': async (harness, alice) => {
    const into = await organizationOf(harness, alice, 'Globex');
    return {
      id: await organizationOf(harness, alice),
      state: () => getJson(harness, alice, '/api/summary'),
      body: { intoId: into },
    };
  },
  'POST /api/organizations/:id/delete': async (harness, alice) => {
    const { contact, organization } = await addContact(harness, alice, 'Julie Martin', {
      newOrganization: { name: 'Acme', type: 'consultancy' },
    });
    // Its Contact leaves it: nothing but the User stands in the way.
    await editContact(harness, alice, contact.id, { name: 'Julie Martin' });
    return { id: organization!.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/positionings/:id/edit': async (harness, alice) => ({
    id: (await positioningOf(harness, alice)).positioning.id,
    state: () => getJson(harness, alice, '/api/summary'),
    body: { ...SHORT_EMAIL, label: 'Bob was here' },
  }),
  'POST /api/positionings/:id/relabel': async (harness, alice) => ({
    id: (await positioningOf(harness, alice)).positioning.id,
    state: () => getJson(harness, alice, '/api/summary'),
    body: { label: 'Bob was here' },
  }),
  'POST /api/positionings/:id/archive': async (harness, alice) => ({
    id: (await positioningOf(harness, alice)).positioning.id,
    state: () => getJson(harness, alice, '/api/summary'),
  }),
  'POST /api/positionings/:id/unarchive': async (harness, alice) => {
    const { positioning } = await positioningOf(harness, alice);
    await positioningGesture(harness, alice, `/api/positionings/${positioning.id}/archive`);
    return { id: positioning.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/positionings/:id/delete': async (harness, alice) => ({
    id: (await positioningOf(harness, alice)).positioning.id,
    state: () => getJson(harness, alice, '/api/summary'),
  }),
  'POST /api/positionings/:id/attachments': async (harness, alice) => ({
    id: (await positioningOf(harness, alice)).positioning.id,
    state: () => getJson(harness, alice, '/api/summary'),
    body: fileOf('CV.pdf'),
  }),
  'POST /api/attachments/:id/remove': async (harness, alice) => {
    const { positioning } = await positioningOf(harness, alice);
    const { attachment } = await attachFile(harness, alice, positioning.id);
    return { id: attachment.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'GET /api/attachments/:id': async (harness, alice) => {
    const { positioning } = await positioningOf(harness, alice);
    const { attachment } = await attachFile(harness, alice, positioning.id);
    return { id: attachment.id, state: () => getJson(harness, alice, '/api/summary') };
  },
  'POST /api/sessions/:id/revoke': async (harness, alice) => {
    const state = () => getJson(harness, alice, '/api/sessions');
    const { sessions } = z
      .object({ sessions: z.array(z.object({ id: z.uuid() })).min(1) })
      .parse(await state());
    return { id: sessions[0]!.id, state };
  },
};

test('the id of another User answers 404 and changes nothing, on every route that takes one', async () => {
  // The Assignments of the Trials to settle and to change, one chance each.
  const harness = testApp({}, { chances: [0, 0] });
  const routes = [
    ...new Set(
      harness.app.routes
        .filter((route) => route.method !== 'ALL' && route.path.includes(':'))
        .map((route) => `${route.method} ${route.path}`),
    ),
  ].toSorted();
  expect(routes).toEqual(Object.keys(CROSS_ACCESS).toSorted());

  for (const route of routes) {
    const alice = await makeUser(harness);
    const bob = await makeUser(harness);
    const { id, state, body = {} } = await CROSS_ACCESS[route]!(harness, alice);
    const before = await state();
    const [method, path = ''] = route.split(' ');
    const named = path.replace(/:\w+/, id);

    let response;
    if (method === 'GET') {
      response = await harness.app.request(named, { headers: { Cookie: bob.cookie } });
    } else if (body instanceof File) {
      response = await postFile(harness.app, named, body, bob.cookie);
    } else {
      response = await postJson(harness.app, named, body, bob.cookie);
    }

    expect(response.status, `on ${route}`).toBe(404);
    expect(await state(), `on ${route}`).toEqual(before);
  }
  // Two Users and a gesture or two per route: it grows with the routes (13 s on CI in October 2026).
}, 60_000);
