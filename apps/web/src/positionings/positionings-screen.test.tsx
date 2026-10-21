import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { z } from 'zod';

import { expectNoAxeViolations } from '../../test/axe.ts';
import { fakeApi } from '../../test/fake-api.ts';
import { renderApp } from '../../test/render-app.tsx';
import {
  battle,
  changes,
  positioning as summaryPositioning,
  stage,
  summary,
} from '../../test/summary.ts';
import type { SummaryBattle, SummaryPositioning } from '../summary.ts';

const desktop = () => page.viewport(1280, 900);
const phone = () => page.viewport(390, 844);

const OUTREACH = stage({ id: '01990000-0000-7000-8000-000000000011', name: 'Approche' });
const SCREENING = stage({ id: '01990000-0000-7000-8000-000000000012', name: 'Qualif ESN' });

/** A Positioning of Approche, by e-mail, with its message and two Follow-ups, unless told otherwise. */
const positioning = (fields: Partial<SummaryPositioning>) =>
  summaryPositioning({
    stageId: OUTREACH.id,
    content: 'Bonjour {prénom}',
    followUps: [
      { days: 3, message: 'Petit up sur mon message.' },
      { days: 7, message: null },
    ],
    ...fields,
  });

const CV_A = {
  id: '01990000-0000-7000-8000-000000000031',
  name: 'CV A.pdf',
  contentType: 'application/pdf',
  size: 245_760,
};
const CV_B = {
  id: '01990000-0000-7000-8000-000000000032',
  name: 'CV B.pdf',
  contentType: 'application/pdf',
  size: 2_621_440,
};

/** Frozen: used in Trials, with its CV. */
const MAIL_LONG = positioning({
  id: '01990000-0000-7000-8000-000000000021',
  label: 'Mail long',
  trialCount: 24,
  used: true,
  attachments: [CV_A],
});
/** A modified copy of the first, never used, with its CV. */
const MAIL_COURT = positioning({
  id: '01990000-0000-7000-8000-000000000022',
  label: 'Mail court',
  derivedFromId: MAIL_LONG.id,
  attachments: [CV_B],
});
/** Used outside a Battle: editable, no longer deletable. */
const LINKEDIN = positioning({
  id: '01990000-0000-7000-8000-000000000023',
  label: 'Message LinkedIn',
  channel: 'linkedin',
  used: true,
});
/** Archived by hand. */
const OLD = positioning({
  id: '01990000-0000-7000-8000-000000000024',
  label: 'Vieux mail',
  archived: true,
});

const NEW_ID = '01990000-0000-7000-8000-000000000029';
const NEW_ATTACHMENT_ID = '01990000-0000-7000-8000-000000000039';
const UNDO_TOKEN = '01990000-0000-7000-8000-00000000000a';
const UNDO_ROUTE = `POST /api/gestures/${UNDO_TOKEN}/undo`;
const gestureRoute = (id: string, gesture: string) => `POST /api/positionings/${id}/${gesture}`;

const fields = z.strictObject({
  label: z.string(),
  channel: z.enum(['email', 'linkedin', 'phone', 'mail']),
  content: z.string().optional(),
  followUps: z.array(z.strictObject({ days: z.number(), message: z.string().optional() })),
  responseWindowDays: z.number(),
});

/** What the server keeps of what the workshop sends. */
const stored = (body: z.infer<typeof fields>) => ({
  label: body.label,
  channel: body.channel,
  content: body.content ?? null,
  followUps: body.followUps.map(({ days, message }) => ({ days, message: message ?? null })),
  responseWindowDays: body.responseWindowDays,
});

/** An API that keeps the Positionings of the workshop as the server would, and takes a gesture back. */
function workshopApi(overrides: Parameters<typeof fakeApi>[0] = {}, battles: SummaryBattle[] = []) {
  let positionings = [MAIL_LONG, MAIL_COURT, LINKEDIN, OLD];
  let before = positionings;
  let undone = changes();
  /** A gesture changed or removed rows: the summary keeps them, “Undo” gives back those it replaced. */
  const answer = (changed: SummaryPositioning[], removedIds: string[] = [], status = 200) => {
    const replaced = new Set([...removedIds, ...changed.map(({ id }) => id)]);
    const created = changed.filter(({ id }) => !positionings.some((row) => row.id === id));
    before = positionings;
    undone = changes({
      positionings: positionings.filter(({ id }) => replaced.has(id)),
      removedPositioningIds: created.map(({ id }) => id),
    });
    positionings = [...positionings.filter(({ id }) => !replaced.has(id)), ...changed];
    return Response.json(
      {
        changes: changes({ positionings: changed, removedPositioningIds: removedIds }),
        undoToken: UNDO_TOKEN,
      },
      { status },
    );
  };
  const find = (id: string) => {
    const found = positionings.find((row) => row.id === id);
    if (!found) throw new Error(`No Positioning ${id}`);
    return found;
  };
  const routes: Parameters<typeof fakeApi>[0] = {
    'GET /api/summary': () =>
      Response.json(
        summary({
          timeZone: 'Europe/Paris',
          settings: {
            activityGoal: { inEffect: 3, chosen: 3 },
            defaultCadence: { intervals: [2, 5, 9], responseWindowDays: 12 },
          },
          stages: [OUTREACH, SCREENING],
          positionings,
          battles,
        }),
      ),
    'POST /api/positionings': (body) => {
      const { stageId, derivedFromId, ...rest } = fields
        .extend({ stageId: z.uuid(), derivedFromId: z.uuid().optional() })
        .parse(body);
      const created = positioning({
        id: NEW_ID,
        ...stored(rest),
        stageId,
        derivedFromId: derivedFromId ?? null,
      });
      return answer([created], [], 201);
    },
    [UNDO_ROUTE]: () => {
      positionings = before;
      return Response.json({ changes: undone });
    },
  };
  for (const { id } of [MAIL_LONG, MAIL_COURT, LINKEDIN, OLD]) {
    routes[gestureRoute(id, 'edit')] = (body) => {
      const { channel } = find(id);
      const edited = fields.omit({ channel: true }).parse(body);
      return answer([{ ...find(id), ...stored({ ...edited, channel }) }]);
    };
    routes[gestureRoute(id, 'relabel')] = (body) => {
      const { label } = z.strictObject({ label: z.string() }).parse(body);
      return answer([{ ...find(id), label }]);
    };
    routes[gestureRoute(id, 'archive')] = () => answer([{ ...find(id), archived: true }]);
    routes[gestureRoute(id, 'unarchive')] = () => answer([{ ...find(id), archived: false }]);
    routes[gestureRoute(id, 'delete')] = () => answer([], [id]);
    routes[gestureRoute(id, 'attachments')] = (body) => {
      const { file } = z.object({ file: z.instanceof(File) }).parse(body);
      const joined = {
        id: NEW_ATTACHMENT_ID,
        name: file.name,
        contentType: file.type,
        size: file.size,
      };
      return answer([{ ...find(id), attachments: [...find(id).attachments, joined] }], [], 201);
    };
  }
  for (const attachment of [CV_A, CV_B]) {
    routes[`POST /api/attachments/${attachment.id}/remove`] = () => {
      const joinedTo = positionings.find((row) =>
        row.attachments.some(({ id }) => id === attachment.id),
      );
      if (!joinedTo) return Response.json({ error: 'not_found' }, { status: 404 });
      const attachments = joinedTo.attachments.filter(({ id }) => id !== attachment.id);
      return answer([{ ...joinedTo, attachments }]);
    };
  }
  return fakeApi({ ...routes, ...overrides });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(async () => {
  await commands.emulateColorScheme('light');
});

const lineage = () => page.getByRole('region', { name: 'Positionnements de Approche' });

test('the workshop: the Stages with their counts, the lineages, a copy under its original, the archived on demand', async () => {
  await desktop();
  const { router } = await renderApp('/positionings', workshopApi());

  const stages = page.getByRole('navigation', { name: 'Étapes' });
  await expect
    .element(stages.getByRole('link', { name: /Approche/ }))
    .toHaveAttribute('aria-current', 'page');
  await expect.element(stages).toHaveTextContent('3 Positionnements non archivés');
  await expect.element(stages).toHaveTextContent('0 Positionnement non archivé');
  expect(router.state.location.search).toEqual({ stage: OUTREACH.id });

  const rows = lineage().getByRole('listitem');
  await expect.element(rows.nth(0)).toHaveTextContent('Mail long');
  await expect.element(rows.nth(0)).toHaveTextContent('E-mail · +3 j, +7 j puis 14 j');
  await expect.element(rows.nth(0)).toHaveTextContent('24 Essais · figé');
  await expect.element(rows.nth(1)).toHaveTextContent('Mail court');
  await expect.element(rows.nth(1)).toHaveTextContent('Copie modifiée de « Mail long »');
  await expect.element(rows.nth(1)).toHaveTextContent('jamais utilisé · modifiable');
  await expect.element(rows.nth(1)).toHaveTextContent('1 pièce jointe');
  expect(getComputedStyle(rows.nth(1).element()).marginInlineStart).not.toBe('0px');
  await expect.element(rows.nth(2)).toHaveTextContent('utilisé hors Battle · modifiable');
  await expect.element(lineage()).not.toHaveTextContent('Vieux mail');

  await lineage().getByRole('button', { name: 'Afficher les archivés (1)' }).click();
  await expect.element(lineage()).toHaveTextContent('Vieux mailarchivé');
  await expect.element(lineage()).toHaveTextContent('archivé à la main');

  await stages.getByRole('link', { name: /Qualif ESN/ }).click();
  await expect
    .element(page.getByRole('region', { name: 'Positionnements de Qualif ESN' }))
    .toHaveTextContent('Aucun Positionnement pour cette Étape.');
});

test('“New”: filled in with the Default follow-up cadence; created with its Channel, content and messages, then “Undo”', async () => {
  await desktop();
  const api = workshopApi();
  const { router } = await renderApp(`/positionings?stage=${SCREENING.id}`, api);

  await page.getByRole('button', { name: 'Nouveau' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nouveau Positionnement' });
  await expect.element(dialog.getByRole('combobox', { name: 'Étape' })).toHaveValue(SCREENING.id);
  await expect.element(dialog).toHaveTextContent('Prérempli avec ta Cadence par défaut');
  await expect
    .element(dialog.getByRole('textbox', { name: 'Relance 1, après (jours)' }))
    .toHaveValue('2');
  await expect
    .element(dialog.getByRole('textbox', { name: 'Délai de réponse (jours)' }))
    .toHaveValue('12');

  await dialog.getByRole('textbox', { name: 'Libellé' }).fill('CV B');
  await dialog.getByText('LinkedIn').click();
  await expect.element(dialog).toHaveTextContent("Un autre canal, c'est un autre Positionnement.");
  await dialog.getByRole('textbox', { name: 'Ce que tu envoies' }).fill('Bonjour ');
  await dialog.getByRole('button', { name: 'Insérer {prénom}' }).click();
  await dialog
    .getByRole('textbox', { name: 'Message de la Relance 1 (facultatif)' })
    .fill('As-tu vu mon CV ?');
  await dialog.getByRole('button', { name: 'Retirer la Relance 3' }).click();
  await dialog.getByRole('button', { name: 'Créer' }).click();

  await expect.element(page.getByText('« CV B » créé.')).toBeVisible();
  expect(api.sent('POST /api/positionings').map(({ body }) => body)).toEqual([
    {
      stageId: SCREENING.id,
      label: 'CV B',
      channel: 'linkedin',
      content: 'Bonjour {prénom}',
      followUps: [{ days: 2, message: 'As-tu vu mon CV ?' }, { days: 5 }],
      responseWindowDays: 12,
    },
  ]);
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(page.getByRole('heading', { level: 2, name: 'CV B' })).toBeVisible();
  expect(router.state.location.search).toEqual({ stage: SCREENING.id, positioning: NEW_ID });

  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  expect(api.sent(UNDO_ROUTE)).toHaveLength(1);
  await expect
    .element(page.getByRole('region', { name: 'Positionnements de Qualif ESN' }))
    .toHaveTextContent('Aucun Positionnement pour cette Étape.');
});

test('a Positioning needs a label', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?stage=${OUTREACH.id}&panel=new`, api);
  const dialog = page.getByRole('dialog', { name: 'Nouveau Positionnement' });

  await dialog.getByRole('button', { name: 'Créer' }).click();

  await expect.element(dialog.getByText('Donne-lui un libellé.')).toBeVisible();
  await expect
    .element(dialog.getByRole('textbox', { name: 'Libellé' }))
    .toHaveAttribute('aria-invalid', 'true');
  expect(api.sent('POST /api/positionings')).toEqual([]);
});

test('never used: Edit, Duplicate… and Delete, with “Undo”', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${MAIL_COURT.id}`, api);
  const record = page.getByRole('region', { name: 'Mail court' });
  await expect.element(record).toHaveTextContent('Pas encore utilisé : tout reste modifiable.');
  await expect.element(record).toHaveTextContent('Relance 1 · +3 jPetit up sur mon message.');
  await expect.element(record).toHaveTextContent('Relance 2 · +7 jsans message');
  await expect.element(record).toHaveTextContent('14 j après la dernière Relance');

  await record.getByRole('button', { name: 'Modifier' }).click();
  const edit = page.getByRole('dialog', { name: 'Modifier « Mail court »' });
  await expect.element(edit).toHaveTextContent('Étape · Approche');
  await expect.element(edit).toHaveTextContent('Canal · E-mail');
  await expect.element(edit.getByRole('radio', { name: 'LinkedIn' })).not.toBeInTheDocument();
  await edit.getByRole('textbox', { name: 'Libellé' }).fill('Mail très court');
  await edit.getByRole('button', { name: 'Enregistrer' }).click();
  await expect.element(page.getByText('« Mail très court » enregistré.')).toBeVisible();
  expect(api.sent(gestureRoute(MAIL_COURT.id, 'edit'))[0]?.body).toEqual({
    label: 'Mail très court',
    content: 'Bonjour {prénom}',
    followUps: [{ days: 3, message: 'Petit up sur mon message.' }, { days: 7 }],
    responseWindowDays: 14,
  });

  await page
    .getByRole('region', { name: 'Mail très court' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect.element(page.getByText('« Mail très court » supprimé.')).toBeVisible();
  await expect.element(lineage()).not.toHaveTextContent('Mail très court');
  await expect
    .element(page.getByText('Choisis un Positionnement pour voir sa fiche.'))
    .toBeVisible();

  await page
    .getByRole('button', { name: /^Annuler$/ })
    .first()
    .click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  await expect.element(lineage()).toHaveTextContent('Mail très court');
});

test('Duplicate… makes a modified copy, filled in with the original', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${MAIL_COURT.id}`, api);

  await page.getByRole('button', { name: 'Dupliquer…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Copie modifiée de « Mail court »' });
  await expect.element(dialog).toHaveTextContent('Reprise de « Mail court ».');
  await expect.element(dialog).toHaveTextContent("L'original reste tel quel.");
  await expect.element(dialog).toHaveTextContent('Sa pièce jointe est reprise dans la copie');
  await dialog.getByRole('textbox', { name: 'Libellé' }).fill('Mail chiffré');
  await dialog.getByRole('button', { name: 'Créer la copie' }).click();

  await expect.element(page.getByText('« Mail chiffré » créé, sous son original.')).toBeVisible();
  expect(api.sent('POST /api/positionings')[0]?.body).toMatchObject({
    stageId: OUTREACH.id,
    derivedFromId: MAIL_COURT.id,
    label: 'Mail chiffré',
    followUps: [{ days: 3, message: 'Petit up sur mon message.' }, { days: 7 }],
  });
});

/** The file picker the “Attach a file” button opens. */
const filePicker = () => document.querySelector<HTMLInputElement>('input[type=file]')!;

test('attachments: each downloaded by its name; one joined, then removed, each with “Undo”', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${MAIL_COURT.id}`, api);
  const record = page.getByRole('region', { name: 'Mail court' });

  const cv = record.getByRole('link', { name: 'CV B.pdf' });
  await expect.element(cv).toHaveAttribute('href', `${location.origin}/api/attachments/${CV_B.id}`);
  await expect.element(cv).toHaveAttribute('download', 'CV B.pdf');
  await expect.element(record).toHaveTextContent('CV B.pdf2,5 Mo');
  await expect.element(record).toHaveTextContent('Tous types, 5 Mo par fichier, 100 Mo en tout.');

  await userEvent.upload(filePicker(), new File(['Bonjour'], 'Lettre.txt', { type: 'text/plain' }));
  await expect.element(page.getByText('« Lettre.txt » joint.')).toBeVisible();
  await expect.element(record.getByRole('link', { name: 'Lettre.txt' })).toBeVisible();
  const [sent] = api.sent(gestureRoute(MAIL_COURT.id, 'attachments'));
  expect(sent?.body).toEqual({ file: expect.any(File) });
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  await expect.element(record.getByRole('link', { name: 'Lettre.txt' })).not.toBeInTheDocument();

  await record.getByRole('button', { name: 'Retirer CV B.pdf' }).click();
  await expect.element(page.getByText('« CV B.pdf » retiré.')).toBeVisible();
  await expect.element(record).toHaveTextContent('Pièces jointesaucune');
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(record.getByRole('link', { name: 'CV B.pdf' })).toBeVisible();
});

test('a file over 5 MB is refused before it is sent; no room left, the server says so', async () => {
  await desktop();
  const api = workshopApi({
    [gestureRoute(MAIL_COURT.id, 'attachments')]: () =>
      Response.json({ error: 'quota_exceeded' }, { status: 409 }),
  });
  await renderApp(`/positionings?positioning=${MAIL_COURT.id}`, api);
  const record = page.getByRole('region', { name: 'Mail court' });
  await expect.element(record.getByRole('button', { name: 'Joindre un fichier' })).toBeVisible();

  await userEvent.upload(filePicker(), new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'Big.pdf'));
  await expect
    .element(record.getByRole('alert'))
    .toHaveTextContent("« Big.pdf » dépasse 5 Mo : il n'a pas été joint.");
  expect(api.sent(gestureRoute(MAIL_COURT.id, 'attachments'))).toHaveLength(0);

  await userEvent.upload(filePicker(), new File(['x'], 'Small.pdf'));
  await expect
    .element(record.getByRole('alert'))
    .toHaveTextContent('Tes pièces jointes dépasseraient 100 Mo en tout');
});

test('frozen: neither Edit nor Delete; Create a modified copy… and Fix the label', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${MAIL_LONG.id}`, api);
  const record = page.getByRole('region', { name: 'Mail long' });
  await expect.element(record).toHaveTextContent('Figé : utilisé dans 24 Essais');
  await expect.element(record).toHaveTextContent('Copies : Mail court');
  await expect.element(record.getByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  await expect.element(record.getByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  // Its attachments are frozen with it, still downloaded.
  await expect.element(record.getByRole('link', { name: 'CV A.pdf' })).toBeVisible();
  await expect
    .element(record.getByRole('button', { name: 'Joindre un fichier' }))
    .not.toBeInTheDocument();
  await expect
    .element(record.getByRole('button', { name: 'Retirer CV A.pdf' }))
    .not.toBeInTheDocument();

  await record.getByRole('button', { name: 'Corriger le libellé' }).click();
  const fix = page.getByRole('dialog', { name: 'Corriger le libellé' });
  await fix.getByRole('textbox', { name: 'Libellé' }).fill('Mail long (v1)');
  await userEvent.keyboard('{Enter}');
  await expect.element(page.getByText('Libellé corrigé : « Mail long (v1) ».')).toBeVisible();
  expect(api.sent(gestureRoute(MAIL_LONG.id, 'relabel'))[0]?.body).toEqual({
    label: 'Mail long (v1)',
  });

  await page.getByRole('button', { name: 'Créer une copie modifiée…' }).click();
  await expect
    .element(page.getByRole('dialog', { name: 'Copie modifiée de « Mail long (v1) »' }))
    .toBeVisible();
});

test('used outside a Battle: editable, but no longer deletable', async () => {
  await desktop();
  await renderApp(`/positionings?positioning=${LINKEDIN.id}`, workshopApi());
  const record = page.getByRole('region', { name: 'Message LinkedIn' });

  await expect
    .element(record)
    .toHaveTextContent('il reste modifiable, mais ne peut plus être supprimé');
  await expect.element(record.getByRole('button', { name: 'Modifier' })).toBeVisible();
  await expect.element(record.getByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
});

test('Archive by hand, with “Undo”', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${LINKEDIN.id}`, api);

  await page.getByRole('button', { name: 'Archiver' }).click();

  await expect
    .element(page.getByText('« Message LinkedIn » archivé. Il pourra revenir comme Challenger.'))
    .toBeVisible();
  await expect
    .element(page.getByRole('region', { name: /Message LinkedIn/ }))
    .toHaveTextContent('Message LinkedIn · archivé');
  await expect.element(lineage()).toHaveTextContent('Afficher les archivés (2)');
  await page.getByRole('button', { name: /^Annuler$/ }).click();
  await expect.element(page.getByText('Annulé.')).toBeVisible();
  await expect.element(page.getByRole('button', { name: 'Archiver' })).toBeVisible();
});

test('in a Battle: the Champion and the Challenger say so; neither is archived while it is open, nor deleted ever', async () => {
  await desktop();
  const api = workshopApi({}, [
    battle({ stageId: OUTREACH.id, championId: LINKEDIN.id, challengerId: MAIL_COURT.id }),
  ]);
  await renderApp(`/positionings?positioning=${MAIL_COURT.id}`, api);

  const rows = lineage().getByRole('listitem');
  await expect.element(rows.nth(1)).toHaveTextContent('Mail courtChallenger');
  await expect.element(rows.nth(2)).toHaveTextContent('Message LinkedInChampion');
  const record = page.getByRole('region', { name: 'Mail court' });
  await expect.element(record.getByRole('button', { name: 'Archiver' })).toBeDisabled();
  await expect
    .element(record)
    .toHaveTextContent(
      "Dans une Battle ouverte : il ne s'archive pas tant qu'elle n'est pas close.",
    );
  await expect.element(record.getByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument();
  await expect
    .element(record)
    .toHaveTextContent(
      'Il a servi dans une Battle : il ne peut plus être supprimé. Archive-le plutôt.',
    );

  await lineage()
    .getByRole('link', { name: /Message LinkedIn/ })
    .click();
  const champion = page.getByRole('region', { name: 'Message LinkedIn' });
  await expect.element(champion.getByRole('button', { name: 'Archiver' })).toBeDisabled();
  await expect
    .element(champion)
    .toHaveTextContent(
      "Champion de son Étape : il ne s'archive pas. Il perd son titre quand un Challenger le bat.",
    );
});

test('Unarchive', async () => {
  await desktop();
  const api = workshopApi();
  await renderApp(`/positionings?positioning=${OLD.id}`, api);

  await page.getByRole('button', { name: 'Désarchiver' }).click();
  await expect.element(page.getByText('« Vieux mail » désarchivé.')).toBeVisible();
  expect(api.sent(gestureRoute(OLD.id, 'unarchive'))).toHaveLength(1);
});

test('on a phone: under More › On desktop, stacked, and its gestures still work', async () => {
  await phone();
  const api = workshopApi();
  await renderApp('/more', api);

  await page.getByRole('link', { name: 'Positionnements' }).click();
  await lineage()
    .getByRole('link', { name: /Mail court/ })
    .click();
  await page.getByRole('button', { name: 'Dupliquer…' }).click();
  const sheet = page.getByRole('dialog', { name: 'Copie modifiée de « Mail court »' });
  await sheet.getByRole('textbox', { name: 'Libellé' }).fill('Mail mobile');
  await sheet.getByRole('button', { name: 'Créer la copie' }).click();

  await expect.element(page.getByText('« Mail mobile » créé, sous son original.')).toBeVisible();
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
});

test.each(['light', 'dark'] as const)(
  'axe finds nothing in the workshop and its panel, in the %s theme',
  async (scheme) => {
    await commands.emulateColorScheme(scheme);
    await desktop();
    await renderApp(`/positionings?positioning=${MAIL_LONG.id}`, workshopApi());
    await expect.element(page.getByRole('region', { name: 'Mail long' })).toBeVisible();
    await expect
      .poll(() => document.documentElement.classList.contains('dark'))
      .toBe(scheme === 'dark');
    await expectNoAxeViolations();

    await page.getByRole('button', { name: 'Créer une copie modifiée…' }).click();
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await expectNoAxeViolations();
  },
);
