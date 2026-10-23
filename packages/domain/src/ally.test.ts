import { describe, expect, test } from 'vitest';

import { allySignal, type AllyContact } from './ally.ts';
import { localDay } from './days.ts';

const TODAY = '2026-10-23';
const RHYTHM = 28;

/** An Ally last in touch on a day, with nothing scheduled. */
const ally = (fields: Partial<AllyContact> = {}): AllyContact => ({
  lastDoneOn: null,
  joinedOn: '2026-10-01',
  followUp: null,
  ...fields,
});

describe('allySignal', () => {
  test('no signal within the Rhythm, soon in its last 7 days, time to check in from its last day', () => {
    expect(allySignal(ally({ lastDoneOn: '2026-10-03' }), TODAY, RHYTHM)).toEqual({
      signal: 'none',
      daysSinceContact: 20,
      dueOn: '2026-10-31',
      followUp: null,
    });
    expect(allySignal(ally({ lastDoneOn: '2026-10-02' }), TODAY, RHYTHM).signal).toBe('soon');
    expect(allySignal(ally({ lastDoneOn: '2026-09-26' }), TODAY, RHYTHM).signal).toBe('soon');
    expect(allySignal(ally({ lastDoneOn: '2026-09-25' }), TODAY, RHYTHM)).toEqual({
      signal: 'time-to-check-in',
      daysSinceContact: 28,
      dueOn: TODAY,
      followUp: null,
    });
  });

  test('without an Interaction done, the Days since contact count from joining the Circle', () => {
    expect(allySignal(ally({ joinedOn: '2026-10-13' }), TODAY, RHYTHM)).toMatchObject({
      signal: 'none',
      daysSinceContact: 10,
      dueOn: '2026-11-10',
    });
  });

  test('a scheduled Follow-up comes before the Rhythm: up to date until its day, then time to check in', () => {
    const longAgo = '2026-08-01';
    expect(
      allySignal(ally({ lastDoneOn: longAgo, followUp: { dueOn: '2026-10-28' } }), TODAY, RHYTHM),
    ).toEqual({ signal: 'none', daysSinceContact: 83, dueOn: '2026-10-28', followUp: 'upcoming' });
    expect(
      allySignal(ally({ lastDoneOn: TODAY, followUp: { dueOn: TODAY } }), TODAY, RHYTHM),
    ).toEqual({ signal: 'time-to-check-in', daysSinceContact: 0, dueOn: TODAY, followUp: 'due' });
    expect(
      allySignal(ally({ lastDoneOn: TODAY, followUp: { dueOn: '2026-10-20' } }), TODAY, RHYTHM)
        .followUp,
    ).toBe('due');
  });

  test('a Rhythm of 7 days or less is soon from the first day', () => {
    expect(allySignal(ally({ lastDoneOn: TODAY }), TODAY, 5).signal).toBe('soon');
    expect(allySignal(ally({ lastDoneOn: '2026-10-18' }), TODAY, 5).signal).toBe(
      'time-to-check-in',
    );
  });

  test('read on the local day of the User: the signal turns at its midnight, not at UTC midnight', () => {
    const lastDone = ally({ lastDoneOn: '2026-09-26' });
    // 23:30 in Paris (UTC+2) on the 23rd, already the 24th in Tokyo.
    const instant = new Date('2026-10-23T21:30:00Z');
    expect(allySignal(lastDone, localDay(instant, 'Europe/Paris'), RHYTHM).signal).toBe('soon');
    expect(allySignal(lastDone, localDay(instant, 'Asia/Tokyo'), RHYTHM).signal).toBe(
      'time-to-check-in',
    );
    // An hour later, midnight has passed in Paris too.
    const later = new Date('2026-10-23T22:30:00Z');
    expect(allySignal(lastDone, localDay(later, 'Europe/Paris'), RHYTHM).daysSinceContact).toBe(28);
  });

  test('the change to winter time moves no day', () => {
    // The night of 24 to 25 October 2026 lasts 25 hours in Paris.
    const lastDone = ally({ lastDoneOn: '2026-10-24' });
    const morning = localDay(new Date('2026-10-25T23:30:00Z'), 'Europe/Paris');
    expect(allySignal(lastDone, morning, RHYTHM).daysSinceContact).toBe(2);
  });
});
