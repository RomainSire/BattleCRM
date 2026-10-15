import { expect, test } from 'vitest';

import {
  canNoteInteraction,
  hasFollowUps,
  isPoolOrArchived,
  statusChangeCancelsFollowUp,
} from './status.ts';

test('only a Contact Prospecting and an Ally have a Follow-up', () => {
  expect(hasFollowUps('prospecting')).toBe(true);
  expect(hasFollowUps('ally')).toBe(true);
  expect(hasFollowUps('pool')).toBe(false);
  expect(hasFollowUps('archived')).toBe(false);
});

test('a Contact in the Pool or Archived is out of the Funnel and of the Circle', () => {
  expect(isPoolOrArchived('pool')).toBe(true);
  expect(isPoolOrArchived('archived')).toBe(true);
  expect(isPoolOrArchived('prospecting')).toBe(false);
  expect(isPoolOrArchived('ally')).toBe(false);
});

test('a change of Status cancels the scheduled Follow-up, unless it is to Prospecting', () => {
  // Leaving Prospecting, or going to the Pool or Archived…
  expect(statusChangeCancelsFollowUp('ally')).toBe(true);
  expect(statusChangeCancelsFollowUp('pool')).toBe(true);
  expect(statusChangeCancelsFollowUp('archived')).toBe(true);
  // …while an Ally entering the Funnel keeps its own.
  expect(statusChangeCancelsFollowUp('prospecting')).toBe(false);
});

test('an Interaction is noted with any Contact but an Ally, with whom it is a Check-in', () => {
  expect(canNoteInteraction('ally')).toBe(false);
  expect(canNoteInteraction('prospecting')).toBe(true);
  expect(canNoteInteraction('pool')).toBe(true);
  expect(canNoteInteraction('archived')).toBe(true);
});
