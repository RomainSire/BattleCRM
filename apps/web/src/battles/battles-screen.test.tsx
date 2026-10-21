import { beforeEach, expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle as summaryBattle,
  changes,
  positioning as summaryPositioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryBattle, SummaryPositioning } from '../summary.ts';

const desktop = () => page.viewport(1280, 900);
const phone = () => page.viewport(390, 844);

const OUTREACH = stage({
  id: '01990000-0000-7000-8000-000000000011',
  name: 'Approche',
  aim: 'CV à envoyer',
});
const SCREENING = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualif ESN' });
const CLOSING = stage({ id: '01990000-0000-7000-8000-000000000013', name: 'Closing' });
const GONE = stage({
  id: '01990000-0000-7000-8000-000000000014',
  name: 'Ancienne',
  archived: true,
});

const positioning = (fields: Partial<SummaryPositioning> & Pick<SummaryPositioning, 'id'>) =>
  summaryPositioning({ stageId: OUTREACH.id, ...fields });
const MAIL_A = positioning({ id: '01990000-0000-7000-8000-000000000021', label: 'Mail A' });
const MAIL_B = positioning({ id: '01990000-0000-7000-8000-000000000022', label: 'Mail B' });
const OLD = positioning({
  id: '01990000-0000-7000-8000-000000000023',
  label: 'Vieux mail',
  archived: true,
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

/** Qualif ESN has an open Battle; Closing had one, closed: its Champion stays. */
const SCREENING_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000031',
  stageId: SCREENING.id,
  championId: CV_A.id,
  challengerId: CV_B.id,
  successCriterion: 'a proposé un entretien',
  openedOn: '2026-01-05',
});

const NEW_BATTLE_ID = '01990000-0000-7000-8000-000000000039';
const NEW_POSITIONING_ID = '01990000-0000-7000-8000-000000000029';
const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;

const opening = z.strictObject({
  stageId: z.uuid(),
  championId: z.uuid().optional(),
  challengerId: z.uuid(),
  successCriterion: z.string(),
  target: z.enum(['consultancy', 'end_client', 'unknown']).nullable(),
  threshold: z.number(),
  horizon: z.number(),
});

/** An API that keeps Battles and Positionings as the server would, and takes an opening back. */
function battlesApi({
  battles: initialBattles = [SCREENING_BATTLE],
  positionings: initialPositionings = [MAIL_A, MAIL_B, OLD, CV_A, CV_B, PITCH],
}: { battles?: SummaryBattle[]; positionings?: SummaryPositioning[] } = {}) {
  let battles = initialBattles;
  let positionings = initialPositionings;
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: 'Europe/Paris',
          stages: [OUTREACH, SCREENING, CLOSING, GONE],
          positionings,
          battles,
        }),
      ),
    'POST /api/battles': (body) => {
      const { stageId, championId, challengerId, ...rest } = opening.parse(body);
      const champion =
        battles.findLast((row) => row.stageId === stageId)?.championId ?? championId ?? '';
      const opened = summaryBattle({
        ...rest,
        id: NEW_BATTLE_ID,
        stageId,
        championId: champion,
        challengerId,
      });
      battles = [...battles, opened];
      // An archived Challenger comes back.
      const broughtBack = positionings
        .filter(({ id, archived }) => archived && (id === challengerId || id === champion))
        .map((row) => ({ ...row, archived: false }));
      positionings = positionings.map((row) => broughtBack.find(({ id }) => id === row.id) ?? row);
      return Response.json(
        {
          changes: changes({ battles: [opened], positionings: broughtBack }),
          undoToken: UNDO_TOKEN,
        },
        { status: 201 },
      );
    },
    'POST /api/positionings': (body) => {
      const { label } = z.object({ label: z.string() }).parse(body);
      const created = positioning({ id: NEW_POSITIONING_ID, label });
      positionings = [...positionings, created];
      return Response.json(
        { changes: changes({ positionings: [created] }), undoToken: UNDO_TOKEN },
        { status: 201 },
      );
    },
    [UNDO_ROUTE]: () => {
      battles = battles.filter(({ id }) => id !== NEW_BATTLE_ID);
      return Response.json({ changes: changes({ removedBattleIds: [NEW_BATTLE_ID] }) });
    },
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

/** Picks a choice of a radio group by its label, as a User clicks it. */
const choose = (group: ReturnType<typeof page.getByRole>, label: string) =>
  group
    .getByText(new RegExp(`^${label}`))
    .first()
    .click();

/** The row of a Stage, by its heading. */
const rowOf = (stageName: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2, name: stageName }) });

test('one row per Stage of the Funnel: its open Battle, or its Champion without one, or neither', async () => {
  await desktop();
  const closed = summaryBattle({
    id: '01990000-0000-7000-8000-000000000032',
    stageId: CLOSING.id,
    championId: PITCH.id,
    challengerId: '01990000-0000-7000-8000-000000000027',
    open: false,
  });
  const old = positioning({
    id: '01990000-0000-7000-8000-000000000027',
    stageId: CLOSING.id,
    label: 'Démo',
  });
  await renderApp(
    '/battles',
    battlesApi({
      battles: [SCREENING_BATTLE, closed],
      positionings: [MAIL_A, MAIL_B, CV_A, CV_B, PITCH, old],
    }),
  );

  await expect.element(page.getByRole('heading', { level: 1, name: 'Battles' })).toBeVisible();
  await expect.element(rowOf('Approche')).toHaveTextContent('Pas de Battle ni de Champion.');
  await expect
    .element(rowOf('Approche').getByRole('button', { name: 'Ouvrir une Battle…' }))
    .toBeVisible();
  await expect
    .element(rowOf('Qualif ESN'))
    .toHaveTextContent('Champion CV A contre Challenger CV B');
  await expect.element(rowOf('Qualif ESN')).toHaveTextContent('Critère : a proposé un entretien');
  await expect.element(rowOf('Qualif ESN')).toHaveTextContent('ouverte le 5 janv.');
  await expect
    .element(rowOf('Qualif ESN').getByRole('button', { name: 'Ouvrir une Battle…' }))
    .not.toBeInTheDocument();
  await expect.element(rowOf('Closing')).toHaveTextContent('Pas de Battle. Champion : Pitch');
  await expect.element(page.getByText('Ancienne')).not.toBeInTheDocument();
  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
  await commands.emulateColorScheme('light');
});

test('the first Battle of a Stage: designate the initial Champion, pick a Challenger, its Success criterion from the Aim, Target and threshold; then “Undo”', async () => {
  await desktop();
  const api = battlesApi();
  const { router } = await renderApp('/battles', api);

  await rowOf('Approche').getByRole('button', { name: 'Ouvrir une Battle…' }).click();
  const wizard = page.getByRole('dialog', { name: 'Ouvrir une Battle · Approche' });
  expect(router.state.location.search).toEqual({ stage: OUTREACH.id, panel: 'open' });
  await expect.element(wizard).toHaveTextContent('1. Qui affronte qui');
  const next = wizard.getByRole('button', { name: 'Suivant' });
  await expect.element(next).toBeDisabled();

  await choose(wizard.getByRole('radiogroup', { name: 'Champion initial' }), 'Mail A');
  const challengers = wizard.getByRole('radiogroup', { name: 'Challenger' });
  await expect.element(challengers.getByRole('radio', { name: 'Mail A' })).not.toBeInTheDocument();
  await expect
    .element(challengers.getByRole('radio', { name: /Vieux mail/ }))
    .toHaveAccessibleName('Vieux mail · archivé, revient comme Challenger');
  await choose(challengers, 'Mail B');
  await next.click();

  await expect.element(wizard).toHaveTextContent('2. Critère de succès');
  const criterion = wizard.getByRole('textbox', { name: 'Critère de succès' });
  await expect.element(criterion).toHaveValue('CV à envoyer');
  await expect.element(wizard).toHaveTextContent('Il ne change plus une fois la Battle ouverte.');
  await criterion.fill('a demandé le CV');
  await next.click();

  await expect.element(wizard).toHaveTextContent('3. Règles');
  await wizard
    .getByRole('combobox', { name: 'Restreindre à une Cible' })
    .selectOptions('Clients finaux uniquement');
  await wizard.getByRole('combobox', { name: 'Seuil de confiance' }).selectOptions('90 %');
  await expect.element(wizard.getByRole('textbox', { name: 'Horizon' })).toHaveValue('25');
  await expect
    .element(wizard)
    .toHaveTextContent(
      "Seuil et Horizon sont figés à l'ouverture. Le minimum (10 Essais terminés par Positionnement, 5 succès) ne se règle pas.",
    );
  await expect
    .element(wizard)
    .toHaveTextContent(
      'On saura si Mail B fait mieux que Mail A pour « a demandé le CV », auprès des clients finaux uniquement, tiré au sort entre les Contacts qui atteignent « Approche » : Verdict possible dès 10 Essais terminés de chaque côté et 5 succès, au plus 25 Essais par Positionnement.',
    );
  await wizard.getByRole('button', { name: 'Ouvrir la Battle' }).click();

  await expect
    .element(page.getByText('Battle ouverte à Approche : Mail A vs Mail B.'))
    .toBeVisible();
  expect(api.sent('POST /api/battles').map(({ body }) => body)).toEqual([
    {
      stageId: OUTREACH.id,
      championId: MAIL_A.id,
      challengerId: MAIL_B.id,
      successCriterion: 'a demandé le CV',
      target: 'end_client',
      threshold: 0.9,
      horizon: 25,
    },
  ]);
  await expect.element(wizard).not.toBeInTheDocument();
  expect(router.state.location.search).toEqual({});
  await expect
    .element(rowOf('Approche'))
    .toHaveTextContent('Champion Mail A contre Challenger Mail B');

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect.element(rowOf('Approche')).toHaveTextContent('Pas de Battle ni de Champion.');
});

test('the next Battle keeps the Champion of the Stage and the Success criterion of the last Battle; an archived Challenger comes back', async () => {
  await desktop();
  const closed = { ...SCREENING_BATTLE, open: false };
  const oldCv = positioning({
    id: '01990000-0000-7000-8000-000000000028',
    stageId: SCREENING.id,
    label: 'CV C',
    archived: true,
  });
  const api = battlesApi({ battles: [closed], positionings: [CV_A, CV_B, oldCv] });
  await renderApp(`/battles?stage=${SCREENING.id}&panel=open`, api);
  const wizard = page.getByRole('dialog', { name: 'Ouvrir une Battle · Qualif ESN' });

  await expect.element(wizard).toHaveTextContent('Champion · CV A');
  await expect
    .element(wizard.getByRole('radiogroup', { name: 'Champion initial' }))
    .not.toBeInTheDocument();
  await choose(wizard.getByRole('radiogroup', { name: 'Challenger' }), 'CV C');
  await wizard.getByRole('button', { name: 'Suivant' }).click();
  await expect
    .element(wizard.getByRole('textbox', { name: 'Critère de succès' }))
    .toHaveValue('a proposé un entretien');
  await wizard.getByRole('button', { name: 'Suivant' }).click();
  await wizard.getByRole('button', { name: 'Ouvrir la Battle' }).click();

  await expect.element(page.getByText('Battle ouverte à Qualif ESN : CV A vs CV C.')).toBeVisible();
  expect(api.sent('POST /api/battles')[0]?.body).toEqual({
    stageId: SCREENING.id,
    challengerId: oldCv.id,
    successCriterion: 'a proposé un entretien',
    target: null,
    threshold: 0.85,
    horizon: 25,
  });
});

test('“+ Create a Positioning” leads back to the wizard, with the new one as the Challenger; “Back” keeps what was chosen', async () => {
  await desktop();
  const api = battlesApi();
  await renderApp(`/battles?stage=${OUTREACH.id}&panel=open`, api);
  const wizard = page.getByRole('dialog', { name: 'Ouvrir une Battle · Approche' });
  await choose(wizard.getByRole('radiogroup', { name: 'Champion initial' }), 'Mail A');

  await wizard.getByRole('button', { name: '+ Créer un Positionnement' }).click();
  const create = page.getByRole('dialog', { name: 'Nouveau Positionnement' });
  await expect.element(create).toHaveTextContent('Étape · Approche');
  await create.getByRole('textbox', { name: 'Libellé' }).fill('Mail C');
  await create.getByRole('button', { name: 'Créer et revenir à la Battle' }).click();

  await expect
    .element(
      wizard.getByRole('radiogroup', { name: 'Challenger' }).getByRole('radio', { name: 'Mail C' }),
    )
    .toBeChecked();
  await expect
    .element(
      wizard
        .getByRole('radiogroup', { name: 'Champion initial' })
        .getByRole('radio', { name: 'Mail A' }),
    )
    .toBeChecked();
  await wizard.getByRole('button', { name: 'Suivant' }).click();
  await wizard.getByRole('button', { name: 'Retour' }).click();
  await expect
    .element(
      wizard.getByRole('radiogroup', { name: 'Challenger' }).getByRole('radio', { name: 'Mail C' }),
    )
    .toBeChecked();
});

test('a Stage needs two Positionings for a Battle', async () => {
  await desktop();
  await renderApp(
    `/battles?stage=${OUTREACH.id}&panel=open`,
    battlesApi({ positionings: [MAIL_A] }),
  );
  const wizard = page.getByRole('dialog', { name: 'Ouvrir une Battle · Approche' });

  await expect
    .element(wizard)
    .toHaveTextContent('Il faut au moins deux Positionnements à cette Étape pour une Battle.');
  await expect
    .element(wizard.getByRole('button', { name: '+ Créer un Positionnement' }))
    .toBeVisible();
});

test('on a phone, the Battles stay readable and the opening stays reachable, stacked', async () => {
  await phone();
  await renderApp('/battles', battlesApi());

  await expect
    .element(rowOf('Qualif ESN'))
    .toHaveTextContent('Champion CV A contre Challenger CV B');
  await rowOf('Approche').getByRole('button', { name: 'Ouvrir une Battle…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Ouvrir une Battle · Approche' }))
    .toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
