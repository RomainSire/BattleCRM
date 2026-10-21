import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { commands, page } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle,
  changes,
  contact,
  organization,
  positioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);
const shown = (day: string) =>
  new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const OTHER_STAGE = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Closing' });
/** The Champion of Approche, against the Challenger, a call followed up a week after. */
const CV = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV Rust',
  content: 'Bonjour {prénom}, freelance Rust.',
});
const CALL = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Appel',
  channel: 'phone',
  followUps: [{ days: 7, message: null }],
});
const BATTLE = battle({
  id: '01990000-0000-7000-8000-000000000041',
  stageId: OUTREACH.id,
  championId: CV.id,
  challengerId: CALL.id,
  target: 'consultancy',
});
const ESN = organization({ id: '01990000-0000-7000-8000-000000000051', name: 'Capgemini' });

const MARC = contact({
  id: '01990000-0000-7000-8000-000000000002',
  name: 'Marc Petit',
  status: 'prospecting',
  stageId: OUTREACH.id,
  organizationId: ESN.id,
});
const LEA = contact({
  id: '01990000-0000-7000-8000-000000000004',
  name: 'Léa Bernard',
  stageId: OUTREACH.id,
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const revealRoute = (id: string) => `POST /api/contacts/${id}/reveal-assignment`;
const useRoute = (id: string) => `POST /api/contacts/${id}/use-positioning`;

type Revealed = {
  assignment: { battleId: string; positioningId: string } | null;
  withoutTrial: 'already_tried' | 'off_target' | 'horizon' | 'trial_in_progress' | null;
};

/** An API with a Battle open at Approche, which reveals `revealed` and starts a Trial on a use. */
function battleApi(revealed: Revealed, { thread = [] as unknown[], contacts = [MARC, LEA] } = {}) {
  const current = new Map(contacts.map((each) => [each.id, each]));
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts: [...current.values()],
          stages: [OUTREACH, OTHER_STAGE],
          organizations: [ESN],
          positionings: [CV, CALL],
          battles: [BATTLE],
        }),
      ),
  };
  for (const before of contacts) {
    routes[`GET /api/contacts/${before.id}/record`] = () => Response.json({ note: null, thread });
    routes[revealRoute(before.id)] = () => {
      const after: SummaryContact = {
        ...(current.get(before.id) ?? before),
        assignment: revealed.assignment,
      };
      current.set(before.id, after);
      return Response.json({ changes: changes({ contacts: [after] }), ...revealed });
    };
    routes[useRoute(before.id)] = (body) => {
      const { positioningId, occurredOn } = z
        .object({ positioningId: z.uuid(), occurredOn: z.iso.date() })
        .parse(body);
      const was = current.get(before.id) ?? before;
      const after: SummaryContact = {
        ...was,
        trial:
          revealed.assignment === null
            ? null
            : {
                battleId: BATTLE.id,
                positioningId,
                startedOn: occurredOn,
                overridden: positioningId !== revealed.assignment.positioningId,
              },
      };
      return Response.json({ changes: changes({ contacts: [after] }), undoToken: UNDO_TOKEN });
    };
    routes[`POST /api/contacts/${before.id}/change-status`] = () => {
      const after: SummaryContact = {
        ...before,
        status: 'prospecting',
        stageId: OUTREACH.id,
        funnelEntryDays: [today()],
      };
      current.set(before.id, after);
      return Response.json({ changes: changes({ contacts: [after] }), undoToken: UNDO_TOKEN });
    };
  }
  return fakeApi(routes);
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await commands.emulateColorScheme('light');
});

test("at a Stage with an open Battle, “Send to” reveals the Positioning assigned at random, and “It's sent” starts a Trial", async () => {
  await desktop();
  const api = battleApi({
    assignment: { battleId: BATTLE.id, positioningId: CALL.id },
    withoutTrial: null,
  });
  await renderApp(`/contacts/${MARC.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });

  await expect.element(dialog).toHaveTextContent('Étape Approche · Battle CV Rust contre Appel');
  await expect.element(dialog).toHaveTextContent('Appeltiré au sort');
  await expect
    .element(dialog)
    .toHaveTextContent('La Battle répartit au hasard pour que la comparaison reste juste.');
  await expect.element(dialog).toHaveTextContent('par Téléphone');
  await expect.element(dialog).toHaveTextContent('Essai commencé');
  await expect.element(dialog).toHaveTextContent(`Relance 1 le ${shown(addDays(today(), 7))}`);
  await expectNoAxeViolations();
  expect(api.sent(revealRoute(MARC.id))).toHaveLength(1);

  await dialog.getByRole('button', { name: "C'est envoyé" }).click();

  await expect
    .element(
      page.getByText(
        `Envoyé à Marc Petit : « Appel », Essai commencé. Relance 1 le ${shown(addDays(today(), 7))}.`,
      ),
    )
    .toBeVisible();
  expect(api.sent(useRoute(MARC.id)).map(({ body }) => body)).toEqual([
    { positioningId: CALL.id, occurredOn: today() },
  ]);
});

test('“I used the other one instead” is an Override: the badge says “your choice”, its reason is optional, and the draw can be taken again', async () => {
  await desktop();
  const api = battleApi({
    assignment: { battleId: BATTLE.id, positioningId: CALL.id },
    withoutTrial: null,
  });
  await renderApp(`/contacts/${MARC.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });

  await dialog.getByRole('button', { name: "J'ai utilisé « CV Rust » à la place" }).click();

  await expect.element(dialog).toHaveTextContent('CV Rustton choix');
  await expect.element(dialog).toHaveTextContent('Bonjour Marc, freelance Rust.');
  await expect.element(dialog).toHaveTextContent('Essai commencé, avec dérogation (ton choix)');
  await dialog.getByRole('button', { name: 'Revenir au tirage : « Appel »' }).click();
  await expect.element(dialog).toHaveTextContent('Appeltiré au sort');
  await dialog.getByRole('button', { name: "J'ai utilisé « CV Rust » à la place" }).click();
  await dialog.getByLabelText('Motif (facultatif)').fill('  il préfère l’écrit ');
  await dialog.getByRole('button', { name: "C'est envoyé" }).click();

  await expect.poll(() => api.sent(useRoute(MARC.id))).toHaveLength(1);
  expect(api.sent(useRoute(MARC.id))[0]?.body).toEqual({
    positioningId: CV.id,
    occurredOn: today(),
    overrideReason: 'il préfère l’écrit',
  });
});

test('out of the Target, the Champion is offered without a Trial, the panel says why; an earlier exposure is told', async () => {
  await desktop();
  const api = battleApi(
    { assignment: null, withoutTrial: 'off_target' },
    {
      thread: [
        {
          id: '01990000-0000-7000-8000-000000000061',
          kind: 'positioning_used',
          direction: 'outbound',
          occurredAt: '2026-03-12T09:00:00.000Z',
          localDate: '2026-03-12',
          note: null,
          channel: null,
          positioningId: CALL.id,
          statusChange: null,
        },
      ],
    },
  );
  await renderApp(`/contacts/${MARC.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });

  await expect
    .element(dialog)
    .toHaveTextContent(
      "Battle restreinte (ESN uniquement) : Marc Petit n'est pas dans sa Cible. Champion proposé, sans Essai.",
    );
  await expect.element(dialog.getByRole('radio', { name: 'CV Rust' })).toBeChecked();
  await expect
    .element(dialog)
    .toHaveTextContent(`Déjà exposé à « Appel » le ${shown('2026-03-12')}.`);
  await expect.element(dialog).toHaveTextContent('Interaction enregistrée, sans Essai');
  await dialog.getByRole('button', { name: "C'est envoyé" }).click();

  await expect
    .element(
      page.getByText(
        `Envoyé à Marc Petit : « CV Rust », sans Essai. Relance 1 le ${shown(addDays(today(), 3))}.`,
      ),
    )
    .toBeVisible();
});

test('with a Trial in progress elsewhere, nothing is sent before it is settled', async () => {
  await desktop();
  const api = battleApi({ assignment: null, withoutTrial: 'trial_in_progress' });
  await renderApp(`/contacts/${MARC.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Marc Petit' });

  await expect
    .element(dialog)
    .toHaveTextContent("Marc Petit a un Essai en cours dans une autre Battle : règle-le d'abord.");
  await expect
    .element(dialog.getByRole('button', { name: "C'est envoyé" }))
    .not.toBeInTheDocument();
  await expect.element(dialog.getByRole('button', { name: 'Plus tard' })).toBeVisible();
});

test('from the Pool, at a Stage with an open Battle, the Contact enters first, then the panel shows what it is assigned', async () => {
  await desktop();
  const api = battleApi({
    assignment: { battleId: BATTLE.id, positioningId: CV.id },
    withoutTrial: null,
  });
  await renderApp(`/contacts/${LEA.id}?send=positioning`, api);
  const dialog = page.getByRole('dialog', { name: 'Envoyer à Léa Bernard' });
  await expect
    .element(dialog)
    .toHaveTextContent(
      "Battle ouverte à l'Étape Approche : fais entrer Léa Bernard pour connaître le Positionnement tiré au sort.",
    );
  await expect
    .element(dialog.getByRole('button', { name: "C'est envoyé" }))
    .not.toBeInTheDocument();
  expect(api.sent(revealRoute(LEA.id))).toEqual([]);

  await dialog.getByRole('button', { name: 'Faire entrer et continuer' }).click();

  await expect.element(dialog).toHaveTextContent('CV Rusttiré au sort');
  expect(api.sent(`POST /api/contacts/${LEA.id}/change-status`)[0]?.body).toEqual({
    status: 'prospecting',
    stageId: OUTREACH.id,
  });
  await expect.element(page.getByText(/Léa Bernard entre dans le Funnel à Approche/)).toBeVisible();
});

test('with a Trial in progress, leaving Prospecting waits for it to be settled', async () => {
  await desktop();
  const tried: SummaryContact = {
    ...MARC,
    trial: {
      battleId: BATTLE.id,
      positioningId: CV.id,
      startedOn: '2026-01-05',
      overridden: false,
    },
  };
  const api = battleApi({ assignment: null, withoutTrial: 'already_tried' }, { contacts: [tried] });
  await renderApp(`/contacts/${MARC.id}?statusTo=pool`, api);
  const dialog = page.getByRole('dialog');

  await expect
    .element(dialog)
    .toHaveTextContent(
      'Marc Petit a un Essai en cours : règle-le avant de quitter En prospection.',
    );
  await expect.element(dialog.getByRole('button', { name: 'Remettre au Vivier' })).toBeDisabled();
});
