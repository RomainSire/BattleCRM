import { expect, test } from 'vitest';

import { firstFollowUpOn, firstNameOf, personalized } from './positioning.ts';

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
