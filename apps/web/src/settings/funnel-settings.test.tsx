import { expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import { battle, changes, contact, positioning, stage, summary } from '../../test/summary.ts';
import type { Summary } from '../summary.ts';

const desktop = () => page.viewport(1280, 900);

const id = (n: number) => `01990000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

const OUTREACH = stage({ id: id(0x11), name: 'Approche', aim: 'CV à envoyer', served: true });
const AGENCY = stage({ id: id(0x12), name: 'Qualif ESN', served: true });
const CLIENT = stage({ id: id(0x13), name: 'Qualif Client' });
const CLOSING = stage({ id: id(0x14), name: 'Closing', served: true });
const OLD = stage({ id: id(0x15), name: 'Veille', archived: true, served: true });
const ADDED = stage({ id: id(0x16), name: 'Nouvelle Étape' });

const MAIL = positioning({ id: id(0x21), stageId: AGENCY.id, label: 'Mail' });
const CALL = positioning({ id: id(0x22), stageId: AGENCY.id, label: 'Appel', channel: 'phone' });
const PAUL = contact({ id: id(0x31), name: 'Paul', status: 'prospecting', stageId: OUTREACH.id });
const JEAN = contact({ id: id(0x32), name: 'Jean', status: 'pool', stageId: CLOSING.id });

const UNDO_TOKEN = id(0x99);

/** A Funnel: Approche with a Contact Prospecting, Qualif ESN with an open Battle, Qualif Client never served, Closing kept by a Contact of the Pool, and Veille archived. */
const start = (): Summary =>
  summary({
    stages: [OUTREACH, AGENCY, CLIENT, CLOSING, OLD],
    contacts: [PAUL, JEAN],
    positionings: [MAIL, CALL],
    battles: [battle({ stageId: AGENCY.id, championId: MAIL.id, challengerId: CALL.id })],
  });

/**
 * An API whose Stage gestures answer with the Funnel `after` says: each answer carries it whole, with
 * a token that “Undo” takes back to where it started.
 */
function funnelApi(
  after: (stages: Summary['stages']) => Summary['stages'] = (stages) => stages,
  refusal?: string,
) {
  let current = start();
  const initial = current.stages;
  const answer = () => {
    if (refusal) return Response.json({ error: refusal }, { status: 409 });
    current = { ...current, stages: after(current.stages) };
    return Response.json({ changes: changes({ stages: current.stages }), undoToken: UNDO_TOKEN });
  };
  const routes: Record<string, () => Response> = {
    'GET /api/summary': () => Response.json(current),
    'POST /api/stages': () => {
      const added = current.stages.some(({ id: stageId }) => stageId === ADDED.id)
        ? { ...ADDED, id: id(0x17) }
        : ADDED;
      current = { ...current, stages: [...current.stages, added] };
      return Response.json(
        { changes: changes({ stages: current.stages }), undoToken: UNDO_TOKEN },
        { status: 201 },
      );
    },
    [`POST /api/gestures/${UNDO_TOKEN}/undo`]: () => {
      current = { ...current, stages: initial };
      return Response.json({ changes: changes({ stages: initial }) });
    },
  };
  for (const { id: stageId } of [...current.stages, ADDED]) {
    for (const gesture of ['edit', 'move', 'archive', 'restore', 'delete']) {
      routes[`POST /api/stages/${stageId}/${gesture}`] = answer;
    }
  }
  return fakeApi(routes);
}

const funnelSection = () => page.getByRole('region', { name: 'Funnel' });
const stageList = () => funnelSection().getByRole('grid', { name: 'Étapes du Funnel' });
const rowOf = (name: string) => stageList().getByRole('row', { name });

test('the Funnel in Settings: its Stages in order with their counters, archive or delete, and the archived ones', async () => {
  await desktop();
  await renderApp('/settings', funnelApi());

  await expect
    .element(
      page
        .getByRole('navigation', { name: 'Sections des réglages' })
        .getByRole('link', { name: 'Funnel' }),
    )
    .toHaveAttribute('href', '#funnel');
  await expect
    .element(
      funnelSection().getByText(
        "Réordonner ne déplace aucun Contact ; l'historique garde l'ordre d'alors.",
        { exact: false },
      ),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole('textbox', { name: "Nom de l'Étape 1" }))
    .toHaveValue('Approche');
  await expect
    .element(page.getByRole('textbox', { name: 'But de Approche' }))
    .toHaveValue('CV à envoyer');
  await expect
    .element(page.getByRole('textbox', { name: "Nom de l'Étape 4" }))
    .toHaveValue('Closing');
  await expect
    .element(rowOf('Approche').getByText('1 En prospection · 0 Positionnement'))
    .toBeVisible();
  await expect
    .element(rowOf('Qualif ESN').getByText('0 En prospection · 2 Positionnements · Battle ouverte'))
    .toBeVisible();

  // Kept in the Funnel: greyed, with the reason and where to lift it.
  await expect.element(page.getByRole('button', { name: 'Archiver Approche…' })).toBeDisabled();
  await expect
    .element(rowOf('Approche').getByText("1 Contact En prospection s'y trouve", { exact: false }))
    .toBeVisible();
  await expect
    .element(rowOf('Approche').getByRole('link', { name: 'Voir le Funnel' }))
    .toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Archiver Qualif ESN…' })).toBeDisabled();
  await expect
    .element(rowOf('Qualif ESN').getByRole('link', { name: 'Voir la Battle' }))
    .toBeVisible();
  // Never served: deleted, not archived.
  await expect.element(page.getByRole('button', { name: 'Supprimer Qualif Client' })).toBeEnabled();
  await expect.element(page.getByRole('button', { name: 'Archiver Closing…' })).toBeEnabled();

  await page.getByRole('button', { name: 'Étapes archivées (1)' }).click();
  await expect.element(page.getByRole('button', { name: 'Restaurer Veille' })).toBeVisible();
  await expectNoAxeViolations();
});

test('renamed in place on Enter, its Aim on leaving the field; “Undo” takes it back', async () => {
  await desktop();
  const api = funnelApi((stages) =>
    stages.map((s) => (s.id === OUTREACH.id ? { ...s, name: 'Premier contact' } : s)),
  );
  await renderApp('/settings', api);

  const name = page.getByRole('textbox', { name: "Nom de l'Étape 1" });
  await name.fill('Premier contact');
  await userEvent.keyboard('{Enter}');

  // Leaving the field right after sends nothing more.
  await page.getByRole('textbox', { name: "Nom de l'Étape 2" }).click();
  await expect.element(page.getByText('Étape « Premier contact » enregistrée')).toBeVisible();
  expect(api.sent(`POST /api/stages/${OUTREACH.id}/edit`).map(({ body }) => body)).toEqual([
    { name: 'Premier contact' },
  ]);

  await page.getByRole('textbox', { name: 'But de Premier contact' }).fill(' ');
  await page.getByRole('textbox', { name: "Nom de l'Étape 2" }).click();
  expect(api.sent(`POST /api/stages/${OUTREACH.id}/edit`).at(-1)?.body).toEqual({ aim: '' });

  await page
    .getByRole('button', { name: /^Annuler$/ })
    .first()
    .click();
  await expect.element(name).toHaveValue('Approche');
});

test('a name left blank is not saved, and says why', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/settings', api);

  await page.getByRole('textbox', { name: "Nom de l'Étape 3" }).fill('  ');
  await userEvent.keyboard('{Enter}');

  await expect.element(page.getByText("Une Étape a besoin d'un nom.")).toBeVisible();
  await expect
    .element(page.getByRole('textbox', { name: "Nom de l'Étape 3" }))
    .toHaveAttribute('aria-invalid', 'true');
  expect(api.sent(`POST /api/stages/${CLIENT.id}/edit`)).toEqual([]);
});

test('Alt+↓ and Alt+↑ move a Stage one place, without a confirmation', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/settings', api);

  await page.getByRole('textbox', { name: "Nom de l'Étape 2" }).click();
  await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
  await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');

  expect(api.sent(`POST /api/stages/${AGENCY.id}/move`).map(({ body }) => body)).toEqual([
    { afterId: CLIENT.id },
    { afterId: null },
  ]);
  await expect.element(page.getByText('Étape « Qualif ESN » déplacée').first()).toBeVisible();
});

test('archiving asks to confirm and says what it does; refused, the Funnel is read again', async () => {
  await desktop();
  const api = funnelApi((stages) =>
    stages.map((s) => (s.id === CLOSING.id ? { ...s, archived: true } : s)),
  );
  await renderApp('/settings', api);

  await page.getByRole('button', { name: 'Archiver Closing…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Archiver « Closing » ?' });
  await expect
    .element(dialog.getByText("1 Contact d'un autre État la garde comme dernière Étape atteinte."))
    .toBeVisible();
  await expect
    .element(
      dialog.getByText(
        'Ses Positionnements, ses Battles et son Historique des Champions restent consultables.',
      ),
    )
    .toBeVisible();
  await expectNoAxeViolations();
  await dialog.getByRole('button', { name: 'Archiver' }).click();

  await expect.element(page.getByText('Étape « Closing » archivée')).toBeVisible();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(page.getByRole('button', { name: 'Étapes archivées (2)' })).toBeVisible();
  expect(api.sent(`POST /api/stages/${CLOSING.id}/archive`)).toHaveLength(1);
});

test('an archiving the API refuses says the Funnel changed elsewhere', async () => {
  await desktop();
  const api = funnelApi(undefined, 'has_contacts');
  await renderApp('/settings', api);

  await page.getByRole('button', { name: 'Archiver Closing…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Archiver' }).click();

  await expect
    .element(page.getByText("Le Funnel a changé sur un autre appareil : il vient d'être relu."))
    .toBeVisible();
  expect(api.sent('GET /api/summary').length).toBeGreaterThan(1);
});

test('a Stage that never served is deleted at once, with “Undo”', async () => {
  await desktop();
  const api = funnelApi((stages) => stages.filter((s) => s.id !== CLIENT.id));
  await renderApp('/settings', api);

  await page.getByRole('button', { name: 'Supprimer Qualif Client' }).click();

  await expect.element(page.getByText('Étape « Qualif Client » supprimée')).toBeVisible();
  await expect.element(rowOf('Qualif Client')).not.toBeInTheDocument();
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(rowOf('Qualif Client')).toBeVisible();
});

test('an archived Stage is restored from “Archived Stages”', async () => {
  await desktop();
  const api = funnelApi((stages) =>
    stages.map((s) => (s.id === OLD.id ? { ...s, archived: false } : s)),
  );
  await renderApp('/settings', api);

  await page.getByRole('button', { name: 'Étapes archivées (1)' }).click();
  await page.getByRole('button', { name: 'Restaurer Veille' }).click();

  await expect.element(page.getByText('Étape « Veille » restaurée')).toBeVisible();
  await expect
    .element(page.getByRole('textbox', { name: "Nom de l'Étape 5" }))
    .toHaveValue('Veille');
  expect(api.sent(`POST /api/stages/${OLD.id}/restore`)).toHaveLength(1);
});

test('“+ Add a Stage” at the end, or one inserted after another: its name takes the focus', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/settings', api);

  await page.getByRole('button', { name: 'Insérer une Étape après Qualif ESN' }).click();
  await expect.element(page.getByRole('textbox', { name: "Nom de l'Étape 5" })).toHaveFocus();
  await page.getByRole('button', { name: 'Ajouter une Étape' }).click();

  expect(api.sent('POST /api/stages').map(({ body }) => body)).toEqual([
    { name: 'Nouvelle Étape', afterId: AGENCY.id },
    { name: 'Nouvelle Étape' },
  ]);
  await expect.element(page.getByText('Étape « Nouvelle Étape » ajoutée').first()).toBeVisible();
});

test('“Rename” in the kanban leads here, the name of its Stage focused; “Manage Stages…” too', async () => {
  await desktop();
  const { router } = await renderApp('/funnel', funnelApi());

  await page.getByRole('button', { name: "Actions de l'Étape Qualif ESN" }).click();
  await page.getByRole('menuitem', { name: 'Renommer' }).click();

  await expect.element(page.getByRole('textbox', { name: "Nom de l'Étape 2" })).toHaveFocus();
  expect(router.state.location.hash).toBe('funnel');

  await router.navigate({ to: '/funnel' });
  await page.getByRole('button', { name: "Actions de l'Étape Approche" }).click();
  await page.getByRole('menuitem', { name: 'Gérer les Étapes…' }).click();
  await expect.element(funnelSection()).toBeVisible();
  expect(router.state.location.search).toEqual({});
});

test('dragged by its handle with the keyboard, a Stage is dropped between two others', async () => {
  await desktop();
  const api = funnelApi();
  await renderApp('/settings', api);

  const handle = page.getByRole('button', { name: 'Déplacer Closing' });
  await expect.element(handle).toBeVisible();
  handle.element().focus();
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{ArrowUp}');
  await userEvent.keyboard('{ArrowUp}');
  await userEvent.keyboard('{Enter}');

  await expect.poll(() => api.sent(`POST /api/stages/${CLOSING.id}/move`).length).toBe(1);
  // From after Closing, two places up: between Qualif ESN and Qualif Client.
  expect(api.sent(`POST /api/stages/${CLOSING.id}/move`)[0]?.body).toEqual({ afterId: AGENCY.id });
});
