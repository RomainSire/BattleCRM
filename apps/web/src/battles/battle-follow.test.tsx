import type { BattleTrial } from '@battlecrm/contract';
import { expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle as summaryBattle,
  changes,
  contact,
  positioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryBattle } from '../summary.ts';

const desktop = () => page.viewport(1280, 900);
const phone = () => page.viewport(390, 844);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const SCREENING = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualif ESN' });
const CLOSING = stage({ id: '01990000-0000-7000-8000-000000000013', name: 'Closing' });

const MAIL_A = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  stageId: OUTREACH.id,
  label: 'Mail A',
});
const MAIL_B = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  stageId: OUTREACH.id,
  label: 'Mail B',
});
const CV_A = positioning({
  id: '01990000-0000-7000-8000-000000000024',
  stageId: SCREENING.id,
  label: 'CV A',
});
const CV_B = positioning({
  id: '01990000-0000-7000-8000-000000000025',
  stageId: SCREENING.id,
  label: 'CV B',
});
const PITCH = positioning({
  id: '01990000-0000-7000-8000-000000000026',
  stageId: CLOSING.id,
  label: 'Pitch',
});
const DEMO = positioning({
  id: '01990000-0000-7000-8000-000000000027',
  stageId: CLOSING.id,
  label: 'Démo',
});

const side = (successes: number, noResults: number, inProgress = 0) => ({
  successes,
  noResults,
  inProgress,
});

/** Approche: Mail B leads Mail A 5/20 to 2/20, P = 0.88: conclusive at 85 %. */
const OUTREACH_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000031',
  stageId: OUTREACH.id,
  championId: MAIL_A.id,
  challengerId: MAIL_B.id,
  trials: { champion: side(2, 18), challenger: side(5, 15) },
});
/** Qualif ESN: 5 + 5 finished, 4 successes: too early. */
const SCREENING_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000032',
  stageId: SCREENING.id,
  championId: CV_A.id,
  challengerId: CV_B.id,
  successCriterion: 'a proposé un entretien',
  openedOn: '2026-01-05',
  trials: { champion: side(1, 4, 2), challenger: side(3, 2, 1) },
});
/** Closing: both at its Horizon of 10, 3/10 each: a draw. */
const CLOSING_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000033',
  stageId: CLOSING.id,
  championId: PITCH.id,
  challengerId: DEMO.id,
  horizon: 10,
  trials: { champion: side(3, 7), challenger: side(3, 7) },
});

const CLAIRE = contact({ id: '01990000-0000-7000-8000-000000000041', name: 'Claire Martin' });
const HUGO = contact({ id: '01990000-0000-7000-8000-000000000042', name: 'Hugo Bernard' });
const LEA = contact({ id: '01990000-0000-7000-8000-000000000043', name: 'Léa Petit' });

const trial = (fields: Partial<BattleTrial> & Pick<BattleTrial, 'id' | 'contactId'>) => ({
  positioningId: CV_A.id,
  startedOn: '2026-01-06',
  outcome: 'in_progress' as const,
  target: 'consultancy' as const,
  cancelReason: null,
  ...fields,
});
const CLAIRE_TRIAL = trial({
  id: '01990000-0000-7000-8000-000000000051',
  contactId: CLAIRE.id,
  outcome: 'success',
});
const HUGO_TRIAL = trial({
  id: '01990000-0000-7000-8000-000000000052',
  contactId: HUGO.id,
  positioningId: CV_B.id,
  startedOn: '2026-01-08',
  target: 'end_client',
});
const LEA_TRIAL = trial({
  id: '01990000-0000-7000-8000-000000000053',
  contactId: LEA.id,
  positioningId: CV_B.id,
  outcome: 'no_result',
});

const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const changeRoute = (trialId: string) => `POST /api/trials/${trialId}/change-outcome`;
const outcomeChange = z.strictObject({
  outcome: z.enum(['in_progress', 'success', 'no_result', 'canceled']),
  cancelReason: z.string().optional(),
});

/** An API that keeps the Trials of Qualif ESN as the server would, and takes a change back. */
function followApi(battles: SummaryBattle[] = [OUTREACH_BATTLE, SCREENING_BATTLE, CLOSING_BATTLE]) {
  let trials = [HUGO_TRIAL, LEA_TRIAL, CLAIRE_TRIAL];
  let before = trials;
  const change = (trialId: string) => (body: unknown) => {
    const { outcome, cancelReason } = outcomeChange.parse(body);
    before = trials;
    trials = trials.map((row) =>
      row.id === trialId ? { ...row, outcome, cancelReason: cancelReason ?? null } : row,
    );
    return Response.json({
      changes: changes({ battles: [SCREENING_BATTLE] }),
      undoToken: UNDO_TOKEN,
    });
  };
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: 'Europe/Paris',
          contacts: [CLAIRE, HUGO, LEA],
          stages: [OUTREACH, SCREENING, CLOSING],
          positionings: [MAIL_A, MAIL_B, CV_A, CV_B, PITCH, DEMO],
          battles,
        }),
      ),
    [`GET /api/battles/${SCREENING_BATTLE.id}/trials`]: () => Response.json({ trials }),
    [changeRoute(CLAIRE_TRIAL.id)]: change(CLAIRE_TRIAL.id),
    [changeRoute(HUGO_TRIAL.id)]: change(HUGO_TRIAL.id),
    [UNDO_ROUTE]: () => {
      trials = before;
      return Response.json({ changes: changes({ battles: [SCREENING_BATTLE] }) });
    },
  });
}

/** The row of a Stage, by its heading. */
const rowOf = (stageName: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2, name: stageName }) });

test('each open Battle says where it stands: its sentence, the finished Trials and successes, its state', async () => {
  await desktop();
  await renderApp('/battles', followApi());

  await expect
    .element(rowOf('Qualif ESN'))
    .toHaveTextContent(
      "Trop tôt pour conclure. CV B mène pour l'instant. Il manque encore 5 Essais terminés pour CV A, 5 pour CV B et 1 succès au total.",
    );
  await expect.element(rowOf('Qualif ESN')).toHaveTextContent('5+5 terminés · 4 succès');
  await expect.element(rowOf('Qualif ESN')).toHaveTextContent('trop tôt');
  await expect
    .element(rowOf('Approche'))
    .toHaveTextContent(
      'Mail B a 88 % de chances de faire mieux que Mail A. La Battle est concluante.',
    );
  await expect.element(rowOf('Approche')).toHaveTextContent('concluante');
  await expect
    .element(rowOf('Closing'))
    .toHaveTextContent('Horizon atteint sans vainqueur : égalité. Pitch garde son titre.');
  await expect.element(rowOf('Closing')).toHaveTextContent('Horizon atteint');
  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
  await commands.emulateColorScheme('light');
});

test('below its threshold, the sentence says how likely the leader is better and what it takes', async () => {
  await desktop();
  await renderApp('/battles', followApi([{ ...OUTREACH_BATTLE, threshold: 0.9 }]));

  await expect
    .element(rowOf('Approche'))
    .toHaveTextContent(
      'Mail B a 88 % de chances de faire mieux que Mail A. Il en faut 90 % pour conclure.',
    );
  await expect.element(rowOf('Approche')).toHaveTextContent('en cours');
});

test('the Battles entry of the menu carries a dot while a Battle is conclusive', async () => {
  await desktop();
  await renderApp('/today', followApi());

  await expect
    .element(page.getByRole('link', { name: 'Battles · Battle concluante' }))
    .toBeVisible();
});

test('no dot on the Battles entry without a conclusive Battle', async () => {
  await desktop();
  await renderApp('/today', followApi([SCREENING_BATTLE]));

  await expect.element(page.getByRole('link', { name: 'Battles', exact: true })).toBeVisible();
});

test('the panel of a Stage follows its Battle: sentence, indicative gauge, progress and settings', async () => {
  await desktop();
  const { router } = await renderApp('/battles', followApi());

  await rowOf('Qualif ESN').getByRole('link', { name: 'Qualif ESN' }).click();

  expect(router.state.location.search).toEqual({ stage: SCREENING.id, panel: 'progress' });
  const panel = page.getByRole('region', { name: 'Qualif ESN' });
  await expect
    .element(panel.getByRole('tab', { name: 'Suivi' }))
    .toHaveAttribute('aria-selected', 'true');
  await expect.element(panel).toHaveTextContent('Trop tôt pour conclure.');
  await expect.element(panel).toHaveTextContent('indicatif');
  await expect.element(panel).toHaveTextContent('CV A : 5/10 terminés · 7/25 commencés');
  await expect.element(panel).toHaveTextContent('CV B : 5/10 terminés · 6/25 commencés');
  await expect.element(panel).toHaveTextContent('Succès au total : 4/5');
  await expect.element(panel).toHaveTextContent('Critère de succès : a proposé un entretien');
  await expect.element(panel).toHaveTextContent('Cible : toutes');
  await expect.element(panel).toHaveTextContent('Seuil : 85 %');
  await expect.element(panel).toHaveTextContent('Horizon : 25');
  await expect.element(panel).toHaveTextContent('ouverte le 5 janv.');
  await expectNoAxeViolations();

  await panel.getByRole('button', { name: 'Fermer' }).click();
  expect(router.state.location.search).toEqual({});
});

test('a click anywhere on the row of a Battle opens its panel', async () => {
  await desktop();
  const { router } = await renderApp('/battles', followApi());

  await rowOf('Closing').click();

  expect(router.state.location.search).toEqual({ stage: CLOSING.id, panel: 'progress' });
  await expect.element(page.getByRole('region', { name: 'Closing' })).toBeVisible();
});

test('a conclusive Battle says so in a banner, and an Horizon reached too', async () => {
  await desktop();
  await renderApp(`/battles?stage=${OUTREACH.id}&panel=progress`, followApi());
  const panel = page.getByRole('region', { name: 'Approche' });

  await expect
    .element(panel)
    .toHaveTextContent("Concluante. Mail B l'emporte selon la Règle de victoire.");
  await expect.element(panel).not.toHaveTextContent('indicatif');
});

test('the Trials of a Battle, their outcome changed in place with the Success criterion recalled; then “Undo”', async () => {
  await desktop();
  const api = followApi();
  await renderApp(`/battles?stage=${SCREENING.id}&panel=progress`, api);
  const panel = page.getByRole('region', { name: 'Qualif ESN' });

  await panel.getByRole('tab', { name: 'Essais' }).click();
  await expect.element(panel).toHaveTextContent('Critère de succès : a proposé un entretien');
  const claire = panel.getByRole('row').filter({ hasText: 'Claire Martin' });
  await expect.element(claire).toHaveTextContent('CV A');
  await expect.element(claire).toHaveTextContent('6 janv.');
  await claire.getByRole('button', { name: "Issue de l'Essai de Claire Martin : Succès" }).click();
  await page.getByRole('menuitem', { name: 'Sans suite' }).click();

  await expect.element(page.getByText('Essai de Claire Martin : Sans suite.')).toBeVisible();
  expect(api.sent(changeRoute(CLAIRE_TRIAL.id)).map(({ body }) => body)).toEqual([
    { outcome: 'no_result' },
  ]);
  await expect
    .element(claire.getByRole('button', { name: "Issue de l'Essai de Claire Martin : Sans suite" }))
    .toBeVisible();
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect
    .element(claire.getByRole('button', { name: "Issue de l'Essai de Claire Martin : Succès" }))
    .toBeVisible();
  await expectNoAxeViolations();
});

test('a Trial canceled from its Battle asks for a reason', async () => {
  await desktop();
  const api = followApi();
  await renderApp(`/battles?stage=${SCREENING.id}&panel=progress`, api);
  const panel = page.getByRole('region', { name: 'Qualif ESN' });
  await panel.getByRole('tab', { name: 'Essais' }).click();

  await panel.getByRole('button', { name: "Issue de l'Essai de Hugo Bernard : En cours" }).click();
  await page.getByRole('menuitem', { name: 'Annulé…' }).click();
  const dialog = page.getByRole('dialog', { name: "Annuler l'Essai de Hugo Bernard" });
  await dialog.getByRole('button', { name: "Annuler l'Essai" }).click();
  await expect.element(dialog).toHaveTextContent("Dis pourquoi l'Essai est annulé.");
  await dialog.getByRole('textbox', { name: "Motif de l'annulation" }).fill('mauvais Contact');
  await dialog.getByRole('button', { name: "Annuler l'Essai" }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(changeRoute(HUGO_TRIAL.id)).map(({ body }) => body)).toEqual([
    { outcome: 'canceled', cancelReason: 'mauvais Contact' },
  ]);
});

test('By Target counts successes on finished Trials, for information only', async () => {
  await desktop();
  await renderApp(`/battles?stage=${SCREENING.id}&panel=progress`, followApi());
  const panel = page.getByRole('region', { name: 'Qualif ESN' });

  await panel.getByRole('tab', { name: 'Par Cible' }).click();

  const consultancy = panel.getByRole('row').filter({ hasText: 'ESN' });
  await expect.element(consultancy).toHaveTextContent('1 succès sur 1');
  await expect.element(consultancy).toHaveTextContent('0 succès sur 1');
  await expect
    .element(panel.getByRole('row').filter({ hasText: 'Clients finaux' }))
    .toHaveTextContent('——');
  await expect.element(panel).toHaveTextContent('À titre indicatif');
});

test('on a phone, the panel of a Stage takes the screen', async () => {
  await phone();
  await renderApp(`/battles?stage=${SCREENING.id}&panel=progress`, followApi());

  await expect.element(page.getByRole('region', { name: 'Qualif ESN' })).toBeVisible();
  await expect.element(rowOf('Approche')).not.toBeInTheDocument();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
