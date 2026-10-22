import { expect, test } from 'vitest';
import { commands, page } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle as summaryBattle,
  changes,
  positioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryBattle, SummaryPositioning } from '../summary.ts';

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

/** Approche: Mail B leads Mail A 5/20 to 2/20, P = 0.88, two Trials still in progress: conclusive. */
const OUTREACH_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000031',
  stageId: OUTREACH.id,
  championId: MAIL_A.id,
  challengerId: MAIL_B.id,
  trials: { champion: side(2, 18, 1), challenger: side(5, 15, 1) },
});
/** Qualif ESN: 5 + 5 finished, 4 successes: too early. */
const SCREENING_BATTLE = summaryBattle({
  id: '01990000-0000-7000-8000-000000000032',
  stageId: SCREENING.id,
  championId: CV_A.id,
  challengerId: CV_B.id,
  trials: { champion: side(1, 4), challenger: side(3, 2) },
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

const closeRoute = (battleId: string) => `POST /api/battles/${battleId}/close`;
const closing = z.strictObject({
  verdict: z.enum(['challenger_wins', 'title_defended', 'draw', 'not_enough_data', 'abandoned']),
  designate: z.boolean().optional(),
  takeaway: z.string().optional(),
});

/**
 * An API that closes a Battle as the server would: the Verdict, the Champion beaten archived (the
 * Challenger, unless it wins; none when abandoned).
 */
function closingApi(
  battles: SummaryBattle[] = [OUTREACH_BATTLE, SCREENING_BATTLE, CLOSING_BATTLE],
) {
  let positionings = [MAIL_A, MAIL_B, CV_A, CV_B, PITCH, DEMO];
  let current = battles;
  const close = (closed: SummaryBattle) => (body: unknown) => {
    const { verdict, designate, takeaway } = closing.parse(body);
    const after: SummaryBattle = {
      ...closed,
      open: false,
      closedOn: '2026-01-12',
      verdict,
      designated: designate === true,
      takeaway: takeaway ?? null,
    };
    const beatenId = verdict === 'challenger_wins' ? closed.championId : closed.challengerId;
    const byId = verdict === 'challenger_wins' ? closed.challengerId : closed.championId;
    const archive = (row: SummaryPositioning): SummaryPositioning =>
      verdict !== 'abandoned' && row.id === beatenId
        ? {
            ...row,
            archived: true,
            archivedByBattle: { againstId: byId, on: '2026-01-12', verdict },
          }
        : row;
    positionings = positionings.map(archive);
    current = current.map((row) => (row.id === closed.id ? after : row));
    return Response.json({
      changes: changes({
        battles: [after],
        positionings: positionings.filter(({ stageId }) => stageId === closed.stageId),
      }),
    });
  };
  return fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: 'Europe/Paris',
          stages: [OUTREACH, SCREENING, CLOSING],
          positionings,
          battles: current,
        }),
      ),
    [`GET /api/battles/${OUTREACH_BATTLE.id}/trials`]: () => Response.json({ trials: [] }),
    [`GET /api/battles/${SCREENING_BATTLE.id}/trials`]: () => Response.json({ trials: [] }),
    [closeRoute(OUTREACH_BATTLE.id)]: close(OUTREACH_BATTLE),
    [closeRoute(SCREENING_BATTLE.id)]: close(SCREENING_BATTLE),
    [closeRoute(CLOSING_BATTLE.id)]: close(CLOSING_BATTLE),
  });
}

/** The row of a Stage, by its heading. */
const rowOf = (stageName: string) =>
  page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2, name: stageName }) });

test('a conclusive Battle is closed from its row, on the Verdict the Win rule proposes: the new Champion first, then the one archived, a Takeaway', async () => {
  await desktop();
  const api = closingApi();
  await renderApp('/battles', api);

  await rowOf('Approche').getByRole('button', { name: 'Clôturer…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Clôturer la Battle · Approche' });
  await expect
    .element(
      dialog.getByRole('radio', { name: /Victoire du Challenger : Mail B devient Champion/ }),
    )
    .toBeChecked();
  await expect
    .element(dialog)
    .toHaveTextContent(
      'Mail B devient Champion de « Approche ». Mail A est archivé, il peut revenir comme Challenger.',
    );
  await expect
    .element(dialog)
    .toHaveTextContent(
      '2 Essais encore en cours passent en annulé (motif « Battle clôturée »), sans toucher à leurs Relances.',
    );
  await expect.element(dialog.getByRole('button', { name: 'Annuler' })).not.toBeInTheDocument();
  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
  await commands.emulateColorScheme('light');
  await dialog
    .getByRole('textbox', { name: 'Enseignement' })
    .fill('Parler du client avant de moi.');
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(closeRoute(OUTREACH_BATTLE.id)).map(({ body }) => body)).toEqual([
    { verdict: 'challenger_wins', takeaway: 'Parler du client avant de moi.' },
  ]);
  await expect.element(page.getByText('Mail B devient Champion de « Approche ».')).toBeVisible();
  await expect.element(rowOf('Approche')).toHaveTextContent('Pas de Battle. Champion : Mail B');
});

test('a winner the Win rule does not satisfy is designated after a warning, its box checked', async () => {
  await desktop();
  const api = closingApi();
  await renderApp(`/battles?stage=${SCREENING.id}&panel=progress`, api);

  await page
    .getByRole('region', { name: 'Qualif ESN' })
    .getByRole('button', { name: 'Clôturer quand même…' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Clôturer la Battle · Qualif ESN' });
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();
  await expect.element(dialog).toHaveTextContent('Choisis un Verdict.');
  // The input of a radio is hidden under its label, which takes the click.
  await dialog.getByText('Victoire du Challenger : CV B devient Champion').click();
  await expect
    .element(dialog)
    .toHaveTextContent(
      "La Règle de victoire n'est pas satisfaite : le minimum n'est pas atteint. Le Verdict sera marqué « désigné par l'Utilisateur » dans l'Historique des Champions.",
    );
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();
  await expect.element(dialog).toHaveTextContent('Coche la case pour désigner ce vainqueur.');
  expect(api.sent(closeRoute(SCREENING_BATTLE.id))).toHaveLength(0);
  await expectNoAxeViolations();
  await dialog.getByText('Je désigne ce vainqueur quand même').click();
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(closeRoute(SCREENING_BATTLE.id)).map(({ body }) => body)).toEqual([
    { verdict: 'challenger_wins', designate: true },
  ]);
  // The panel of the Stage stays, now without an open Battle.
  await expect
    .element(page.getByRole('region', { name: 'Qualif ESN' }))
    .toHaveTextContent('Champion : CV B');
});

test('at the Horizon without a winner, the draw is proposed and the Takeaway featured; abandoning says it taught nothing', async () => {
  await desktop();
  const api = closingApi();
  await renderApp(`/battles?stage=${CLOSING.id}&panel=close`, api);
  const dialog = page.getByRole('dialog', { name: 'Clôturer la Battle · Closing' });

  await expect
    .element(dialog.getByRole('radio', { name: /Égalité : Pitch garde son titre/ }))
    .toBeChecked();
  await expect
    .element(dialog)
    .toHaveTextContent(
      "Pas d'écart détectable entre Pitch et Démo : à ce volume, seul un écart important se voit. Les deux se valent probablement ; Pitch garde son titre. Démo est archivé, il peut revenir comme Challenger.",
    );
  await expect
    .element(dialog.getByRole('textbox', { name: 'Enseignement' }))
    .toHaveAccessibleDescription(/La Battle n'a pas départagé les deux/);
  await dialog.getByText('Abandonner la Battle').click();
  await expect
    .element(dialog)
    .toHaveTextContent("Abandonner, c'est dire que cette Battle n'a rien appris");
  await expect
    .element(dialog)
    .toHaveTextContent("Pitch garde son titre ; Démo n'est pas archivé et reste disponible.");
  await dialog.getByRole('button', { name: 'Plus tard' }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(closeRoute(CLOSING_BATTLE.id))).toHaveLength(0);
  await expect.element(page.getByRole('region', { name: 'Closing' })).toBeVisible();
});

/** Approche, after two Battles: Mail B beat Mail A, proven; then Mail C was abandoned. */
const MAIL_C = positioning({
  id: '01990000-0000-7000-8000-000000000023',
  stageId: OUTREACH.id,
  label: 'Mail C',
});
const FIRST_CLOSED = summaryBattle({
  ...OUTREACH_BATTLE,
  open: false,
  closedOn: '2026-01-12',
  verdict: 'challenger_wins',
  takeaway: 'Parler du client avant de moi.',
});
const SECOND_CLOSED = summaryBattle({
  id: '01990000-0000-7000-8000-000000000034',
  stageId: OUTREACH.id,
  championId: MAIL_B.id,
  challengerId: MAIL_C.id,
  openedOn: '2026-01-13',
  open: false,
  closedOn: '2026-01-20',
  verdict: 'abandoned',
});

test('the Champion history: one lineage per Stage, each Champion with its date and Takeaway, the Verdict on the arrows, written out', async () => {
  await desktop();
  const api = fakeApi({
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: 'Europe/Paris',
          stages: [OUTREACH, SCREENING],
          positionings: [{ ...MAIL_A, archived: true }, MAIL_B, MAIL_C, CV_A, CV_B],
          battles: [FIRST_CLOSED, SECOND_CLOSED, SCREENING_BATTLE],
        }),
      ),
    [`POST /api/battles/${SECOND_CLOSED.id}/takeaway`]: () =>
      Response.json({
        changes: changes({ battles: [{ ...SECOND_CLOSED, takeaway: 'Mon TJM a changé.' }] }),
        undoToken: '01990000-0000-7000-8000-00000000000a',
      }),
  });
  await renderApp('/battles', api);

  await page.getByRole('tab', { name: 'Historique des Champions' }).click();

  const outreach = page
    .getByRole('tabpanel', { name: 'Historique des Champions' })
    .getByRole('list')
    .first();
  await expect
    .element(outreach)
    .toHaveTextContent(
      "Mail AChampion initial · désigné · le 5 janv. 2026Victoire du Challenger contre Mail BMail Bprouvé par les données · le 12 janv. 2026« Parler du client avant de moi. »ModifierAbandonnée contre Mail CMail Btitre conservé · le 20 janv. 2026Pas d'Enseignement.Ajouter",
    );
  await expect.element(page.getByText(/Fond plein : prouvé par les données/)).toBeVisible();
  await expect.element(page.getByText(/Battle en cours contre CV B/)).toBeVisible();
  await expectNoAxeViolations();
  await commands.emulateColorScheme('dark');
  await expectNoAxeViolations();
  await commands.emulateColorScheme('light');

  await page
    .getByRole('button', { name: 'Ajouter un Enseignement à la Battle contre Mail C' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Enseignement · Mail B contre Mail C' });
  await dialog.getByRole('textbox', { name: "Qu'en retiens-tu ?" }).fill('Mon TJM a changé.');
  await dialog.getByRole('button', { name: 'Enregistrer' }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(
    api.sent(`POST /api/battles/${SECOND_CLOSED.id}/takeaway`).map(({ body }) => body),
  ).toEqual([{ takeaway: 'Mon TJM a changé.' }]);
  await expect.element(page.getByText('Enseignement enregistré.')).toBeVisible();
  await expect.element(page.getByRole('button', { name: /^Annuler$/ })).toBeVisible();
  await expect.element(page.getByText('« Mon TJM a changé. »')).toBeVisible();
});

test('a designated winner is hatched and says so; the panel of a Stage without a Battle shows its Champion and its history', async () => {
  await desktop();
  await renderApp(
    `/battles?stage=${OUTREACH.id}&panel=progress`,
    fakeApi({
      'GET /api/summary': () =>
        Response.json(
          summary({
            timeZone: 'Europe/Paris',
            stages: [OUTREACH],
            positionings: [MAIL_A, MAIL_B, MAIL_C],
            battles: [
              { ...FIRST_CLOSED, designated: true },
              { ...SECOND_CLOSED, verdict: 'title_defended', designated: true },
            ],
          }),
        ),
    }),
  );
  const panel = page.getByRole('region', { name: 'Approche' });

  await expect.element(panel).toHaveTextContent('Champion : Mail B');
  await expect
    .element(panel)
    .toHaveTextContent('Victoire du Challenger contre Mail B, désigné par toi');
  await expect.element(panel).toHaveTextContent('Mail Bdésigné par toi · le 12 janv. 2026');
  // A title defended against the rule is designated too, never merely kept.
  await expect
    .element(panel)
    .toHaveTextContent(
      'Titre défendu contre Mail C, désigné par toiMail Bdésigné par toi · le 20 janv. 2026',
    );
  await panel.getByRole('button', { name: 'Ouvrir une Battle…' }).click();
  await expect.element(page.getByRole('dialog')).toBeVisible();
});

test('on a phone, a Battle is closed too', async () => {
  await phone();
  const api = closingApi();
  await renderApp('/battles', api);

  await rowOf('Approche').getByRole('button', { name: 'Clôturer…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clôturer la Battle · Approche' });
  await dialog.getByRole('button', { name: 'Clôturer', exact: true }).click();

  await expect.element(dialog).not.toBeInTheDocument();
  expect(api.sent(closeRoute(OUTREACH_BATTLE.id))).toHaveLength(1);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});
