import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { battle, changes, contact, positioning, stage, summary } from '../../test/summary.ts';
import type { SummaryBattle, SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);
const shown = (day: string) =>
  new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
/** The Champion of Approche, its Response window of 14 days, against the Challenger. */
const CV = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV Rust',
  responseWindowDays: 14,
});
const CALL = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Appel',
  channel: 'phone',
});
const BATTLE = battle({
  id: '01990000-0000-7000-8000-000000000041',
  stageId: OUTREACH.id,
  championId: CV.id,
  challengerId: CALL.id,
  successCriterion: 'a demandé le CV',
  startedTrials: 9,
  finishedTrials: 3,
});

/** Claire, sent CV Rust `days` days ago in the Battle, nothing since, nothing scheduled. */
const claire = (days: number, fields: Partial<SummaryContact> = {}) => {
  const sentOn = addDays(today(), -days);
  return contact({
    id: '01990000-0000-7000-8000-000000000001',
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: OUTREACH.id,
    lastDoneInteractionOn: sentOn,
    trial: { battleId: BATTLE.id, positioningId: CV.id, startedOn: sentOn, overridden: false },
    ...fields,
  });
};

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const route = (gesture: string) =>
  `POST /api/contacts/01990000-0000-7000-8000-000000000001/${gesture}`;

/** The Battle once the Trial is settled: one more finished. */
const settledBattle: SummaryBattle = { ...BATTLE, finishedTrials: BATTLE.finishedTrials + 1 };

/** An API where Claire has a Trial in progress, settled by any gesture that settles one. */
function trialApi(before: SummaryContact) {
  /** Claire once her Trial is settled, in the Status the gesture asks. */
  const settled = (body: unknown) => {
    const { status } = z.object({ status: z.string().optional() }).parse(body);
    const after: SummaryContact = {
      ...before,
      trial: null,
      ...(status === 'pool' && { status }),
      ...(status === 'archived' && { status }),
      ...(status === 'ally' && { status }),
    };
    return Response.json({
      changes: changes({ contacts: [after], battles: [settledBattle] }),
      undoToken: UNDO_TOKEN,
    });
  };
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts: [before],
          stages: [OUTREACH],
          positionings: [CV, CALL],
          battles: [BATTLE],
        }),
      ),
    [`GET /api/contacts/${before.id}/record`]: () => Response.json({ note: null, thread: [] }),
    [route('settle-trial')]: settled,
    [route('record-reply')]: settled,
    [route('change-status')]: settled,
    [route('follow-up')]: () =>
      Response.json({
        changes: changes({ contacts: [{ ...before, lastDoneInteractionOn: today() }] }),
        undoToken: UNDO_TOKEN,
      }),
    [UNDO_ROUTE]: () =>
      Response.json({ changes: changes({ contacts: [before], battles: [BATTLE] }) }),
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('a Trial whose Response window elapsed calls “No result…”, which settles it and puts the Contact back in the Pool by default; then “Undo”', async () => {
  await desktop();
  const api = trialApi(claire(20));
  await renderApp(`/contacts/${claire(20).id}`, api);

  const trialBlock = page.getByRole('region', { name: 'Essai en cours' });
  await expect.element(trialBlock).toHaveTextContent('CV Rust');
  await expect.element(trialBlock).toHaveTextContent('Champion');
  await expect.element(trialBlock).toHaveTextContent('a demandé le CV');
  await expect.element(trialBlock).toHaveTextContent('délai dépassé');
  await page.getByRole('button', { name: 'Sans suite…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Essai sans suite · Claire Martin' });
  await expect
    .element(dialog)
    .toHaveTextContent(
      "Remettre Claire Martin au Vivier ? Il reviendra dans les propositions d'entrée.",
    );
  await expect.element(dialog.getByRole('radio', { name: 'Remettre au Vivier' })).toBeChecked();
  await expectNoAxeViolations();
  await dialog.getByRole('button', { name: 'Classer sans suite' }).click();

  expect(api.sent(route('settle-trial')).map(({ body }) => body)).toEqual([
    { outcome: 'no_result', status: 'pool' },
  ]);
  await expect
    .element(
      page.getByText(
        'Essai sans suite : un point de donnée de plus pour la Battle “Approche” (4/9 terminés).',
      ),
    )
    .toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
});

test('“Follow up anyway” follows up off the Cadence, a deviation traced on the Trial', async () => {
  await desktop();
  const api = trialApi(claire(20));
  await renderApp(`/contacts/${claire(20).id}`, api);

  await page.getByRole('button', { name: 'Relancer quand même' }).click();

  const dialog = page.getByRole('dialog', { name: 'Relancer Claire Martin quand même' });
  await expect.element(dialog).toHaveTextContent("Hors Cadence : un écart tracé sur l'Essai");
  await dialog.getByRole('button', { name: 'Relancer', exact: true }).click();

  expect(api.sent(route('follow-up')).map(({ body }) => body)).toEqual([
    { occurredOn: today(), anyway: true },
  ]);
});

test('“Replied…” recalls the Criterion and waits for the Trial to be settled, by 1, 2 or 3, never preselected', async () => {
  await desktop();
  const api = trialApi(claire(2));
  await renderApp(`/contacts/${claire(2).id}`, api);
  await expect
    .element(page.getByText(`délai dépassé le ${shown(addDays(today(), 12))}`).first())
    .toBeVisible();

  await page.getByRole('button', { name: 'A répondu…' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Claire Martin a répondu' });
  await expect.element(dialog).toHaveTextContent('Critère : a demandé le CV');
  const save = dialog.getByRole('button', { name: 'Enregistrer la réponse' });
  await expect.element(save).toBeDisabled();
  await dialog.getByRole('heading', { name: 'Sa réponse' }).click();
  await userEvent.keyboard('3');
  await expect.element(dialog.getByRole('radio', { name: 'Laisser en cours' })).toBeChecked();
  await expect
    .element(dialog)
    .toHaveTextContent(`L'Essai reste en cours : délai dépassé le ${shown(addDays(today(), 14))}`);
  await userEvent.keyboard('2');
  await expect.element(dialog.getByRole('radio', { name: 'Remettre au Vivier' })).toBeChecked();
  await expectNoAxeViolations();
  await save.click();

  expect(api.sent(route('record-reply')).map(({ body }) => body)).toEqual([
    { occurredOn: today(), channel: 'email', trialOutcome: 'no_result', status: 'pool' },
  ]);
  await expect
    .element(page.getByText(/Essai sans suite : un point de donnée de plus/))
    .toBeVisible();
});

test('adding to the Circle from Prospecting settles the Trial, a Success proposed', async () => {
  await desktop();
  const api = trialApi(claire(2));
  await renderApp(`/contacts/${claire(2).id}?statusTo=ally`, api);

  const toCircle = page.getByRole('dialog', { name: 'Ajouter Claire Martin au Cercle' });
  await expect.element(toCircle).toHaveTextContent('Critère : a demandé le CV');
  await expect.element(toCircle.getByRole('radio', { name: 'Succès' })).toBeChecked();
  await toCircle.getByRole('button', { name: 'Ajouter au Cercle' }).click();

  expect(api.sent(route('change-status')).map(({ body }) => body)).toEqual([
    { status: 'ally', trialOutcome: 'success' },
  ]);
});

test('archiving settles the Trial too, nothing proposed; canceled asks why', async () => {
  await desktop();
  const api = trialApi(claire(2));
  await renderApp(`/contacts/${claire(2).id}?statusTo=archived`, api);

  const toArchive = page.getByRole('dialog', { name: 'Archiver Claire Martin' });
  const archive = toArchive.getByRole('button', { name: 'Archiver' });
  await expect.element(archive).toBeDisabled();
  await toArchive.getByText('Annulé', { exact: true }).click();
  await archive.click();
  await expect.element(toArchive.getByText("Dis pourquoi l'Essai est annulé.")).toBeVisible();
  await toArchive
    .getByRole('textbox', { name: "Motif de l'annulation" })
    .fill('a changé de métier');
  await archive.click();

  expect(api.sent(route('change-status')).map(({ body }) => body)).toEqual([
    { status: 'archived', trialOutcome: 'canceled', cancelReason: 'a changé de métier' },
  ]);
});
