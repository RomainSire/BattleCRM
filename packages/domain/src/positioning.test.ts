import { expect, test } from 'vitest';

import {
  cadenceFollowUpOn,
  firstFollowUpOn,
  firstNameOf,
  personalized,
  shiftedFollowUpOn,
} from './positioning.ts';

test('the first name of a Contact is the first word of its name', () => {
  expect(firstNameOf('Claire Martin')).toBe('Claire');
  expect(firstNameOf('  Jean-Pierre   de La Tour ')).toBe('Jean-Pierre');
  expect(firstNameOf('Inès')).toBe('Inès');
});

test('what is sent stands the first name of the Contact for the token, in either language, everywhere', () => {
  expect(personalized('Bonjour {prénom}, {prénom} !', 'Claire Martin')).toBe(
    'Bonjour Claire, Claire !',
  );
  expect(personalized('Hi {first name}, or {prénom}', 'Claire Martin')).toBe(
    'Hi Claire, or Claire',
  );
  expect(personalized('No token here', 'Claire Martin')).toBe('No token here');
});

test('the first Follow-up of the Cadence comes its first interval after the use, none without one', () => {
  expect(firstFollowUpOn('2026-01-30', [3, 7, 14])).toBe('2026-02-02');
  expect(firstFollowUpOn('2026-01-05', [])).toBeUndefined();
});

test('each Follow-up of the Cadence comes its interval after the last outbound Interaction done, none past the last rank', () => {
  expect(cadenceFollowUpOn(1, '2026-01-05', [3, 7, 14])).toBe('2026-01-08');
  expect(cadenceFollowUpOn(2, '2026-01-08', [3, 7, 14])).toBe('2026-01-15');
  expect(cadenceFollowUpOn(3, '2026-01-30', [3, 7, 14])).toBe('2026-02-13');
  expect(cadenceFollowUpOn(4, '2026-02-13', [3, 7, 14])).toBeUndefined();
});

test('an outbound Interaction pushes the Follow-up of the Cadence back, never forward', () => {
  // Follow-up 2 was due 7 days after Follow-up 1, done on the 8th: a call on the 10th moves it to the 17th.
  expect(shiftedFollowUpOn({ dueOn: '2026-01-15', rank: 2 }, '2026-01-10', [3, 7, 14])).toBe(
    '2026-01-17',
  );
  // A call dated before the last outbound Interaction changes nothing.
  expect(shiftedFollowUpOn({ dueOn: '2026-01-15', rank: 2 }, '2026-01-08', [3, 7, 14])).toBe(
    '2026-01-15',
  );
  // A day the User moved later stays.
  expect(shiftedFollowUpOn({ dueOn: '2026-01-30', rank: 2 }, '2026-01-10', [3, 7, 14])).toBe(
    '2026-01-30',
  );
  // Off the Cadence, or past its ranks, it does not move.
  expect(shiftedFollowUpOn({ dueOn: '2026-01-15', rank: null }, '2026-01-10', [3, 7, 14])).toBe(
    '2026-01-15',
  );
  expect(shiftedFollowUpOn({ dueOn: '2026-01-15', rank: 2 }, '2026-01-10', [3])).toBe('2026-01-15');
});
