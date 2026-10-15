import { ATTACHMENT_MAX_BYTES } from '@battlecrm/contract';
import { sql } from 'drizzle-orm';
import { expect, test } from 'vitest';
import { z } from 'zod';

import { testApp } from '../../test/app.ts';
import { summaryPositioning } from '../../test/factories/contact.ts';
import { undo } from '../../test/factories/gesture.ts';
import {
  attachFile,
  createPositioning,
  fileOf,
  positioningGesture,
  stageIdsOf,
} from '../../test/factories/positioning.ts';
import { makeUser } from '../../test/factories/user.ts';
import { postFile, postJson } from '../../test/http.ts';
import { withUser } from '../db/index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

/** A User and a Positioning of its own, at the first Stage of its Funnel. */
async function workshop() {
  const harness = testApp();
  const user = await makeUser(harness);
  const [outreach = ''] = await stageIdsOf(harness, user);
  const { positioning } = await createPositioning(harness, user, outreach);
  return { harness, user, outreach, positioning };
}

const positioningsOf = async (harness: Harness, user: User) => {
  const response = await harness.app.request('/api/summary', { headers: { Cookie: user.cookie } });
  return z.object({ positionings: z.array(summaryPositioning) }).parse(await response.json())
    .positionings;
};

const attachmentsOf = async (harness: Harness, user: User, positioningId: string) =>
  (await positioningsOf(harness, user)).find(({ id }) => id === positioningId)?.attachments;

const download = (harness: Harness, user: User, attachmentId: string) =>
  harness.app.request(`/api/attachments/${attachmentId}`, { headers: { Cookie: user.cookie } });

/** The bytes the storage keeps for the User, removed attachments included. */
const storedBlobs = (user: User) =>
  withUser(user.userId, async (tx) => {
    const { rows } = await tx.execute<{ count: string }>(
      sql`select count(*) from attachment_blob where user_id = ${user.userId}`,
    );
    return Number(rows[0]?.count);
  });

test('a file joined: in the summary, downloaded as an attachment, never sniffed; “Undo” leaves no trace', async () => {
  const { harness, user, positioning } = await workshop();

  const { attachment, undoToken } = await attachFile(
    harness,
    user,
    positioning.id,
    fileOf('CV.pdf', 1000),
  );

  expect(attachment).toEqual({
    id: attachment.id,
    name: 'CV.pdf',
    contentType: 'application/pdf',
    size: 1000,
  });
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([attachment]);
  const downloaded = await download(harness, user, attachment.id);
  expect(downloaded.status).toBe(200);
  expect(downloaded.headers.get('Content-Type')).toBe('application/pdf');
  expect(downloaded.headers.get('Content-Disposition')).toBe(
    `attachment; filename="CV.pdf"; filename*=UTF-8''CV.pdf`,
  );
  expect(downloaded.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(new Uint8Array(await downloaded.arrayBuffer())).toEqual(
    new Uint8Array(1000).fill('C'.codePointAt(0)!),
  );

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([]);
  expect((await download(harness, user, attachment.id)).status).toBe(404);
  expect(await storedBlobs(user)).toBe(0);
});

test('any type is joined; its name loses its path, and is saved as it was written', async () => {
  const { harness, user, positioning } = await workshop();

  const { attachment: page } = await attachFile(
    harness,
    user,
    positioning.id,
    fileOf('C:\\Users\\moi\\Lettre « été ».html', 16, 'text/html; charset=utf-8'),
  );
  const { attachment: unknown } = await attachFile(
    harness,
    user,
    positioning.id,
    fileOf('notes', 16, ''),
  );

  expect(page).toMatchObject({ name: 'Lettre « été ».html', contentType: 'text/html' });
  expect(unknown).toMatchObject({ name: 'notes', contentType: 'application/octet-stream' });
  const downloaded = await download(harness, user, page.id);
  expect(downloaded.headers.get('Content-Disposition')).toBe(
    `attachment; filename="Lettre _ _t_ _.html"; filename*=UTF-8''Lettre%20%C2%AB%20%C3%A9t%C3%A9%20%C2%BB.html`,
  );
  expect(downloaded.headers.get('X-Content-Type-Options')).toBe('nosniff');
});

test('a file over 5 MiB is refused, and nothing is joined', async () => {
  const { harness, user, positioning } = await workshop();

  const refused = await postFile(
    harness.app,
    `/api/positionings/${positioning.id}/attachments`,
    fileOf('Big.pdf', ATTACHMENT_MAX_BYTES + 1),
    user.cookie,
  );
  const { attachment } = await attachFile(
    harness,
    user,
    positioning.id,
    fileOf('Just.pdf', ATTACHMENT_MAX_BYTES),
  );

  expect(refused.status).toBe(413);
  expect(await refused.json()).toEqual({ error: 'too_large' });
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([attachment]);
});

test('past 100 MiB for the User, a file is refused; removing one makes room again', async () => {
  const { harness, user, positioning } = await workshop();
  const joined = [];
  for (let index = 0; index < 20; index++) {
    joined.push(
      (
        await attachFile(
          harness,
          user,
          positioning.id,
          fileOf(`${index}.pdf`, ATTACHMENT_MAX_BYTES),
        )
      ).attachment,
    );
  }

  const refused = await postFile(
    harness.app,
    `/api/positionings/${positioning.id}/attachments`,
    fileOf('One more byte', 1),
    user.cookie,
  );
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'quota_exceeded' });

  await positioningGesture(harness, user, `/api/attachments/${joined[0]!.id}/remove`);
  await attachFile(harness, user, positioning.id, fileOf('One more byte', 1));
}, 60_000);

test('Remove: gone from the summary and the download; “Undo” brings it back, until it is purged', async () => {
  const { harness, user, positioning } = await workshop();
  const { attachment } = await attachFile(harness, user, positioning.id);
  harness.clock.advance('PT1M');

  const { changes, undoToken } = await positioningGesture(
    harness,
    user,
    `/api/attachments/${attachment.id}/remove`,
  );

  expect(changes.positionings).toEqual([{ ...positioning, attachments: [] }]);
  expect((await download(harness, user, attachment.id)).status).toBe(404);
  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([attachment]);
  expect((await download(harness, user, attachment.id)).status).toBe(200);

  // Removed again, then left past the reach of “Undo”: the next gesture of the workshop purges it.
  harness.clock.advance('PT1M');
  await positioningGesture(harness, user, `/api/attachments/${attachment.id}/remove`);
  expect(await storedBlobs(user)).toBe(1);
  harness.clock.advance('PT16M');
  await positioningGesture(harness, user, `/api/positionings/${positioning.id}/archive`);
  expect(await storedBlobs(user)).toBe(0);
});

test('“Undo” of a removal is refused once a later gesture touched the same Positioning', async () => {
  const { harness, user, positioning } = await workshop();
  const { attachment } = await attachFile(harness, user, positioning.id);
  harness.clock.advance('PT1M');
  const { undoToken } = await positioningGesture(
    harness,
    user,
    `/api/attachments/${attachment.id}/remove`,
  );
  harness.clock.advance('PT1M');
  await attachFile(harness, user, positioning.id, fileOf('Lettre.pdf'));

  expect((await undo(harness, user, undoToken)).status).toBe(409);
  expect((await download(harness, user, attachment.id)).status).toBe(404);
});

test('Delete a Positioning never used: its attachments go with it; “Undo” brings them back', async () => {
  const { harness, user, positioning } = await workshop();
  const { attachment } = await attachFile(harness, user, positioning.id);
  harness.clock.advance('PT1M');

  const { undoToken } = await positioningGesture(
    harness,
    user,
    `/api/positionings/${positioning.id}/delete`,
  );
  expect((await download(harness, user, attachment.id)).status).toBe(404);

  expect((await undo(harness, user, undoToken)).status).toBe(200);
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([attachment]);
  expect((await download(harness, user, attachment.id)).status).toBe(200);
});

test('a modified copy takes the attachments of its original, as files of its own; “Undo” erases them', async () => {
  const { harness, user, outreach, positioning } = await workshop();
  const { attachment } = await attachFile(harness, user, positioning.id, fileOf('CV A.pdf', 100));

  const { positioning: copy } = await createPositioning(harness, user, outreach, {
    derivedFromId: positioning.id,
  });

  const [copied] = copy.attachments;
  expect(copy.attachments).toEqual([{ ...attachment, id: copied!.id }]);
  expect(copied!.id).not.toBe(attachment.id);
  expect(new Uint8Array(await (await download(harness, user, copied!.id)).arrayBuffer())).toEqual(
    new Uint8Array(100).fill('C'.codePointAt(0)!),
  );

  // Removed from the copy, it stays on the original.
  harness.clock.advance('PT1M');
  await positioningGesture(harness, user, `/api/attachments/${copied!.id}/remove`);
  expect(await attachmentsOf(harness, user, positioning.id)).toEqual([attachment]);

  const { positioning: other, undoToken: otherToken } = await createPositioning(
    harness,
    user,
    outreach,
    { derivedFromId: positioning.id },
  );
  expect((await undo(harness, user, otherToken)).status).toBe(200);
  expect((await download(harness, user, other.attachments[0]!.id)).status).toBe(404);
  expect(await storedBlobs(user)).toBe(2);
});

test('a modified copy is refused when its attachments would not fit in the room of the User', async () => {
  const { harness, user, outreach, positioning } = await workshop();
  for (let index = 0; index < 11; index++) {
    await attachFile(harness, user, positioning.id, fileOf(`${index}.pdf`, ATTACHMENT_MAX_BYTES));
  }

  const refused = await postJson(
    harness.app,
    '/api/positionings',
    {
      label: 'Copie',
      channel: 'email',
      followUps: [],
      responseWindowDays: 14,
      stageId: outreach,
      derivedFromId: positioning.id,
    },
    user.cookie,
  );

  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({ error: 'quota_exceeded' });
  expect(await positioningsOf(harness, user)).toHaveLength(1);
}, 60_000);

test('an unknown Positioning or attachment answers 404; a form without a file, 400', async () => {
  const { harness, user, positioning } = await workshop();

  for (const id of ['00000000-0000-7000-8000-000000000000', 'not-an-id']) {
    const joined = await postFile(
      harness.app,
      `/api/positionings/${id}/attachments`,
      fileOf('CV.pdf'),
      user.cookie,
    );
    expect(joined.status).toBe(404);
    expect(
      (await postJson(harness.app, `/api/attachments/${id}/remove`, {}, user.cookie)).status,
    ).toBe(404);
    expect((await download(harness, user, id)).status).toBe(404);
  }
  const empty = await postJson(
    harness.app,
    `/api/positionings/${positioning.id}/attachments`,
    {},
    user.cookie,
  );
  expect(empty.status).toBe(400);
});
