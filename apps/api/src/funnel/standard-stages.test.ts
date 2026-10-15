import { expect, test } from 'vitest';

import { testApp } from '../../test/app.ts';
import { summaryOf } from '../../test/factories/contact.ts';
import { makeUser } from '../../test/factories/user.ts';
import { withUser } from '../db/index.ts';
import { stageOrder } from './index.ts';

type Harness = ReturnType<typeof testApp>;
type User = Awaited<ReturnType<typeof makeUser>>;

const stagesOf = async (harness: Harness, user: User) => (await summaryOf(harness, user)).stages;

test('a new account has the four Standard stages, with their Aim, in the language of its sign-up attempt', async () => {
  const harness = testApp();

  const french = await stagesOf(harness, await makeUser(harness, { locale: 'fr' }));
  const english = await stagesOf(harness, await makeUser(harness, { locale: 'en' }));

  expect(french.map(({ name, aim, archived }) => ({ name, aim, archived }))).toEqual([
    { name: 'Approche', aim: 'CV à envoyer', archived: false },
    { name: 'Qualif ESN', aim: 'entretien ESN à obtenir', archived: false },
    { name: 'Qualif Client', aim: 'entretien client à obtenir', archived: false },
    { name: 'Closing', aim: 'contrat à signer', archived: false },
  ]);
  expect(english.map(({ name, aim }) => ({ name, aim }))).toEqual([
    { name: 'Outreach', aim: 'get asked for a CV' },
    { name: 'Agency screening', aim: 'get the agency interview' },
    { name: 'Client screening', aim: 'get the client interview' },
    { name: 'Closing', aim: 'sign the contract' },
  ]);
});

test('stageOrder gives the Stages of the Funnel of its User, in their order', async () => {
  const harness = testApp();
  const alice = await makeUser(harness);
  await makeUser(harness);

  const stages = await withUser(alice.userId, (tx) => stageOrder(tx, alice.userId));

  expect(stages.map(({ id, name }) => ({ id, name }))).toEqual(
    (await stagesOf(harness, alice)).map(({ id, name }) => ({ id, name })),
  );
});
