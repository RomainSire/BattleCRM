import { addDays, localDay } from '@battlecrm/domain';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { battle, changes, contact, positioning, stage, summary } from '../../test/summary.ts';
import type { SummaryContact } from '../summary.ts';

const desktop = () => page.viewport(1280, 800);

const TIME_ZONE = 'Europe/Paris';
const today = () => localDay(new Date(), TIME_ZONE);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const AGENCY = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualif ESN' });
const CLOSING = stage({ id: '01990000-0000-7000-8000-000000000013', name: 'Closing' });
const CV = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'CV Rust',
});
const CALL = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Appel',
  channel: 'phone',
});
const AGENCY_MAIL = positioning({
  id: '01990000-0000-7000-8000-000000000023',
  stageId: AGENCY.id,
  label: 'Mail ESN',
});
const AGENCY_CALL = positioning({
  id: '01990000-0000-7000-8000-000000000024',
  stageId: AGENCY.id,
  label: 'Appel ESN',
  channel: 'phone',
});
const CLOSING_MAIL = positioning({
  id: '01990000-0000-7000-8000-000000000025',
  stageId: CLOSING.id,
  label: 'Proposition',
});
const CLOSING_CALL = positioning({
  id: '01990000-0000-7000-8000-000000000026',
  stageId: CLOSING.id,
  label: 'Appel closing',
  channel: 'phone',
});
const BATTLE = battle({
  id: '01990000-0000-7000-8000-000000000041',
  stageId: OUTREACH.id,
  championId: CV.id,
  challengerId: CALL.id,
  successCriterion: 'a demandé le CV',
});
const CLOSING_BATTLE = battle({
  id: '01990000-0000-7000-8000-000000000042',
  stageId: CLOSING.id,
  championId: CLOSING_MAIL.id,
  challengerId: CLOSING_CALL.id,
  successCriterion: 'a signé',
});

const CLAIRE_ID = '01990000-0000-7000-8000-000000000001';
/** Claire, Prospecting at a Stage, Follow-up 1 scheduled in two days. */
const claire = (fields: Partial<SummaryContact> = {}) =>
  contact({
    id: CLAIRE_ID,
    name: 'Claire Martin',
    status: 'prospecting',
    stageId: OUTREACH.id,
    followUp: { dueOn: addDays(today(), 2), note: null, rank: 1 },
    ...fields,
  });
/** …with a Trial in progress, in the Battle of her Stage. */
const trying = (battleId: string, positioningId: string, fields: Partial<SummaryContact> = {}) =>
  claire({
    trial: { battleId, positioningId, startedOn: today(), overridden: false },
    lastDoneInteractionOn: today(),
    ...fields,
  });

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const route = (gesture: string) => `POST /api/contacts/${CLAIRE_ID}/${gesture}`;

/** What a gesture on Claire answers: her row after it, and its token. */
const answer = (after: SummaryContact) =>
  Response.json({ changes: changes({ contacts: [after] }), undoToken: UNDO_TOKEN });

/** An API where Claire changes Stage, or Status, as asked. */
function stageApi(before: SummaryContact) {
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: TIME_ZONE,
          contacts: [before],
          stages: [OUTREACH, AGENCY, CLOSING],
          positionings: [CV, CALL, AGENCY_MAIL, AGENCY_CALL, CLOSING_MAIL, CLOSING_CALL],
          battles: [BATTLE, CLOSING_BATTLE],
        }),
      ),
    [`GET /api/contacts/${CLAIRE_ID}/record`]: () => Response.json({ note: null, thread: [] }),
    [route('change-stage')]: (body) => {
      const { stageId } = z.object({ stageId: z.string() }).parse(body);
      return answer({ ...before, stageId, trial: null, assignment: null });
    },
    [route('change-status')]: () => answer({ ...before, status: 'ally', trial: null }),
    [route('record-reply')]: () => answer({ ...before, trial: null }),
    [route('reveal-assignment')]: () =>
      Response.json({ changes: changes(), assignment: null, withoutTrial: 'already_tried' }),
    [UNDO_ROUTE]: () => Response.json({ changes: changes({ contacts: [before] }) }),
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

test('the pill of the Stage opens “Change stage…”: the next Stage by default, its Positionings told without a Battle; then “Undo”', async () => {
  await desktop();
  const api = stageApi(claire());
  await renderApp(`/contacts/${CLAIRE_ID}`, api);

  await page.getByRole('button', { name: "Changer d'Étape : Approche" }).click();

  const dialog = page.getByRole('dialog', { name: "Changer Claire Martin d'Étape" });
  await expect
    .element(dialog.getByRole('combobox', { name: 'Nouvelle Étape' }))
    .toHaveDisplayValue('Avancer à Qualif ESN');
  await expect
    .element(dialog)
    .toHaveTextContent('Pas de Battle ouverte à Qualif ESN : 2 Positionnements disponibles.');
  await expect.element(dialog).toHaveTextContent('Avance : de Approche à Qualif ESN');
  await expectNoAxeViolations();
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();

  expect(api.sent(route('change-stage')).map(({ body }) => body)).toEqual([{ stageId: AGENCY.id }]);
  await expect.element(page.getByText('Claire Martin avance à Qualif ESN')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
});

test('with a Trial in progress, moving on proposes a Success, then cancels Follow-up 1 (checked); going back proposes to leave it, said as a step back', async () => {
  await desktop();
  const api = stageApi(trying(BATTLE.id, CV.id));
  await renderApp(`/contacts/${CLAIRE_ID}`, api);

  await page.getByRole('heading', { name: 'Claire Martin', level: 1 }).click();
  await userEvent.keyboard('e');

  const dialog = page.getByRole('dialog', { name: "Changer Claire Martin d'Étape" });
  await expect.element(dialog).toHaveTextContent('Critère : a demandé le CV');
  await expect.element(dialog.getByRole('radio', { name: 'Succès' })).toBeChecked();
  await expect
    .element(dialog.getByRole('checkbox', { name: /Annuler la Relance 1/ }))
    .toBeChecked();
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();

  expect(api.sent(route('change-stage')).map(({ body }) => body)).toEqual([
    { stageId: AGENCY.id, trialOutcome: 'success', cancelFollowUp: true },
  ]);
});

test('going back is said as such, and leaves the Trial in progress by default', async () => {
  await desktop();
  const api = stageApi(trying(BATTLE.id, CV.id, { stageId: AGENCY.id }));
  await renderApp(`/contacts/${CLAIRE_ID}?stageTo=${OUTREACH.id}`, api);

  const dialog = page.getByRole('dialog', { name: "Changer Claire Martin d'Étape" });
  await expect
    .element(dialog.getByRole('combobox', { name: 'Nouvelle Étape' }))
    .toHaveDisplayValue('Revenir à Approche');
  await expect.element(dialog).toHaveTextContent('Recul : de Qualif ESN à Approche');
  await expect.element(dialog.getByRole('radio', { name: 'Laisser en cours' })).toBeChecked();
  await expect
    .element(dialog.getByRole('checkbox', { name: /Annuler la Relance/ }))
    .not.toBeInTheDocument();
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();

  expect(api.sent(route('change-stage')).map(({ body }) => body)).toEqual([
    { stageId: OUTREACH.id, trialOutcome: 'in_progress' },
  ]);
});

test('an open Battle at the arrival chains to “Use a Positioning” (checked)', async () => {
  await desktop();
  const api = stageApi(claire({ stageId: AGENCY.id }));
  const { router } = await renderApp(`/contacts/${CLAIRE_ID}?stageTo=${CLOSING.id}`, api);

  const dialog = page.getByRole('dialog', { name: "Changer Claire Martin d'Étape" });
  const chain = dialog.getByRole('checkbox', {
    name: 'Enchaîner : utiliser un Positionnement maintenant',
  });
  await expect.element(chain).toBeChecked();
  await dialog.getByRole('button', { name: "Changer d'Étape" }).click();

  await expect.poll(() => router.state.location.search).toMatchObject({ send: 'positioning' });
  expect(router.state.location.search).not.toHaveProperty('stageTo');
});

test('a Success at the last Stage proposes the Circle, preselected, or to stay Prospecting', async () => {
  await desktop();
  const api = stageApi(trying(CLOSING_BATTLE.id, CLOSING_MAIL.id, { stageId: CLOSING.id }));
  await renderApp(`/contacts/${CLAIRE_ID}?stageTo=choose`, api);

  const dialog = page.getByRole('dialog', { name: "Changer Claire Martin d'Étape" });
  await dialog.getByText('Succès', { exact: true }).click();
  await expect
    .element(dialog)
    .toHaveTextContent('Succès à la dernière Étape : ajouter Claire Martin au Cercle ?');
  await expect.element(dialog.getByRole('radio', { name: 'Ajouter au Cercle' })).toBeChecked();
  await expectNoAxeViolations();
  await dialog.getByRole('button', { name: 'Ajouter au Cercle' }).click();

  expect(api.sent(route('change-status')).map(({ body }) => body)).toEqual([
    { status: 'ally', trialOutcome: 'success' },
  ]);
  expect(api.sent(route('change-stage'))).toEqual([]);
});

test('only a Contact Prospecting changes Stage: no pill nor verb otherwise', async () => {
  await desktop();
  const api = stageApi(claire({ status: 'pool', followUp: null }));
  await renderApp(`/contacts/${CLAIRE_ID}?stageTo=choose`, api);

  await expect
    .element(page.getByRole('heading', { name: 'Claire Martin', level: 1 }))
    .toBeVisible();
  expect(page.getByRole('dialog').elements()).toEqual([]);
  expect(page.getByRole('button', { name: /Changer d'Étape/ }).elements()).toEqual([]);
});

test('“Replied…” with a Success moves on to the next Stage by default, or stays, or another', async () => {
  await desktop();
  const api = stageApi(trying(BATTLE.id, CV.id));
  await renderApp(`/contacts/${CLAIRE_ID}?interaction=reply`, api);

  const dialog = page.getByRole('dialog', { name: 'Claire Martin a répondu' });
  const stageField = dialog.getByRole('combobox', { name: 'Étape' });
  await expect.element(stageField).toHaveDisplayValue('Rester à Approche');
  await dialog.getByText('Succès', { exact: true }).click();
  await expect.element(stageField).toHaveDisplayValue('Avancer à Qualif ESN');
  await expect.element(dialog).toHaveTextContent('Avance : de Approche à Qualif ESN');
  await expectNoAxeViolations();
  await dialog.getByRole('button', { name: 'Enregistrer la réponse' }).click();

  expect(api.sent(route('record-reply')).map(({ body }) => body)).toEqual([
    {
      occurredOn: today(),
      channel: 'email',
      cancelFollowUp: true,
      trialOutcome: 'success',
      stageId: AGENCY.id,
    },
  ]);
});

test('“Replied…” with a Success at the last Stage proposes the Circle, preselected', async () => {
  await desktop();
  const api = stageApi(trying(CLOSING_BATTLE.id, CLOSING_MAIL.id, { stageId: CLOSING.id }));
  await renderApp(`/contacts/${CLAIRE_ID}?interaction=reply`, api);

  const dialog = page.getByRole('dialog', { name: 'Claire Martin a répondu' });
  await dialog.getByText('Succès', { exact: true }).click();
  await expect.element(dialog.getByRole('radio', { name: 'Ajouter au Cercle' })).toBeChecked();
  await expect
    .element(dialog.getByRole('radio', { name: 'Rester En prospection à Closing' }))
    .not.toBeChecked();
  await dialog.getByRole('button', { name: 'Enregistrer la réponse' }).click();

  expect(api.sent(route('record-reply')).map(({ body }) => body)).toEqual([
    {
      occurredOn: today(),
      channel: 'email',
      cancelFollowUp: true,
      trialOutcome: 'success',
      status: 'ally',
    },
  ]);
});
