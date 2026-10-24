import * as fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { byUrgency, contactAgenda, hasNoNextStep, type AgendaContact } from './agenda.ts';

const TODAY = '2026-10-23';

/** A Contact Prospecting at a Stage that has a Positioning, with nothing ahead. */
const contact = (fields: Partial<AgendaContact> = {}): AgendaContact => ({
  followUp: null,
  trialWindow: null,
  stageHasPositioning: true,
  ...fields,
});

describe('contactAgenda', () => {
  test('a Follow-up overdue or due today needs action, since its day', () => {
    expect(contactAgenda(contact({ followUp: { dueOn: '2026-10-20' } }), TODAY)).toEqual({
      row: 'needs-action',
      reason: 'follow-up-overdue',
      on: '2026-10-20',
    });
    expect(contactAgenda(contact({ followUp: { dueOn: TODAY } }), TODAY)).toEqual({
      row: 'needs-action',
      reason: 'follow-up-today',
      on: TODAY,
    });
  });

  test('a Follow-up to come is waited for, even with a Trial in progress past its window', () => {
    const agenda = contactAgenda(
      contact({
        followUp: { dueOn: '2026-10-25' },
        trialWindow: { lastDoneOn: '2026-01-01', responseWindowDays: 14 },
      }),
      TODAY,
    );
    expect(agenda).toEqual({ row: 'waiting', reason: 'follow-up-upcoming', on: '2026-10-25' });
  });

  test('a Trial in progress without a Follow-up: waited for within its Response window, Window elapsed from its last day, the day it ends', () => {
    expect(
      contactAgenda(
        contact({ trialWindow: { lastDoneOn: '2026-10-20', responseWindowDays: 14 } }),
        TODAY,
      ),
    ).toEqual({ row: 'waiting', reason: 'trial', on: '2026-11-03' });
    expect(
      contactAgenda(
        contact({ trialWindow: { lastDoneOn: '2026-10-09', responseWindowDays: 14 } }),
        TODAY,
      ),
    ).toEqual({ row: 'needs-action', reason: 'window-elapsed', on: TODAY });
  });

  test('nothing ahead: No next step at a Stage with a Positioning, Waiting at one without', () => {
    expect(contactAgenda(contact(), TODAY)).toEqual({ row: 'no-next-step' });
    expect(contactAgenda(contact({ stageHasPositioning: false }), TODAY)).toEqual({
      row: 'waiting',
      reason: 'no-positioning',
    });
  });
});

describe('byUrgency', () => {
  test('the oldest overdue Follow-up first, then today, Window elapsed, No next step, then Waiting: Follow-ups by date, Trials, Stages without a Positioning', () => {
    const agendas = [
      contactAgenda(contact({ followUp: { dueOn: '2026-10-30' } }), TODAY),
      contactAgenda(contact(), TODAY),
      contactAgenda(contact({ stageHasPositioning: false }), TODAY),
      contactAgenda(
        contact({ trialWindow: { lastDoneOn: '2026-10-01', responseWindowDays: 14 } }),
        TODAY,
      ),
      contactAgenda(contact({ followUp: { dueOn: TODAY } }), TODAY),
      contactAgenda(contact({ followUp: { dueOn: '2026-10-21' } }), TODAY),
      contactAgenda(contact({ followUp: { dueOn: '2026-10-25' } }), TODAY),
      contactAgenda(contact({ followUp: { dueOn: '2026-10-10' } }), TODAY),
      contactAgenda(
        contact({ trialWindow: { lastDoneOn: '2026-10-20', responseWindowDays: 5 } }),
        TODAY,
      ),
      contactAgenda(
        contact({ trialWindow: { lastDoneOn: '2026-10-20', responseWindowDays: 3 } }),
        TODAY,
      ),
    ];
    expect(agendas.toSorted(byUrgency)).toEqual([
      { row: 'needs-action', reason: 'follow-up-overdue', on: '2026-10-10' },
      { row: 'needs-action', reason: 'follow-up-overdue', on: '2026-10-21' },
      { row: 'needs-action', reason: 'follow-up-today', on: TODAY },
      { row: 'needs-action', reason: 'window-elapsed', on: '2026-10-15' },
      { row: 'needs-action', reason: 'window-elapsed', on: TODAY },
      { row: 'no-next-step' },
      { row: 'waiting', reason: 'follow-up-upcoming', on: '2026-10-25' },
      { row: 'waiting', reason: 'follow-up-upcoming', on: '2026-10-30' },
      { row: 'waiting', reason: 'trial', on: '2026-10-25' },
      { row: 'waiting', reason: 'no-positioning' },
    ]);
  });
});

test('No next step reads the same from its facts alone as from the whole agenda', () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (hasFollowUp, hasTrial, stageHasPositioning) => {
        const agenda = contactAgenda(
          {
            followUp: hasFollowUp ? { dueOn: '2026-01-09' } : null,
            trialWindow: hasTrial ? { lastDoneOn: '2026-01-05', responseWindowDays: 14 } : null,
            stageHasPositioning,
          },
          '2026-01-06',
        );
        expect(
          hasNoNextStep({ hasFollowUp, hasTrialInProgress: hasTrial, stageHasPositioning }),
        ).toBe(agenda.row === 'no-next-step');
      },
    ),
  );
});
