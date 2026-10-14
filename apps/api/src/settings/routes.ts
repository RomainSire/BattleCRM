import { FOLLOW_UP_INTERVALS_MAX, GOAL_MAX, SETTING_DAYS_MAX } from '@battlecrm/contract';
import { locales } from '@battlecrm/i18n/runtime';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app.ts';
import type { RequireUser } from '../auth/index.ts';
import type { Clock } from '../clock.ts';
import { withUser } from '../db/index.ts';
import { jsonBody } from '../json-body.ts';
import { settingsOf } from './read.ts';
import { userSettings } from './tables.ts';
import { isTimeZone } from './time-zone.ts';
import { changeActivityGoal, changeEntryGoal, changeTimeZone } from './write.ts';

const goal = z.int().min(1).max(GOAL_MAX);
const days = z.int().min(1).max(SETTING_DAYS_MAX);

/**
 * Settings save field by field (spec UX §5.8): only what is sent changes. “Undo” sends the values
 * from before, which leave no trace (write.ts).
 */
const changeSettingsRequest = z.object({
  locale: z.enum(locales).optional(),
  timeZone: z.string().refine(isTimeZone).optional(),
  activityGoal: goal.nullable().optional(),
  entryGoal: goal.nullable().optional(),
  celebrateGoal: z.boolean().optional(),
  singleKeyShortcuts: z.boolean().optional(),
  checkInRhythmDays: days.optional(),
  circleSizeGoal: goal.nullable().optional(),
  defaultCadence: z
    .object({
      intervals: z.array(days).min(1).max(FOLLOW_UP_INTERVALS_MAX),
      responseWindowDays: days,
    })
    .optional(),
});

/** Settings (spec UX §5.8): preferences and values in effect, as the summary carries them. */
export function createSettings({ clock, requireUser }: { clock: Clock; requireUser: RequireUser }) {
  const routes = new Hono<AppEnv>().post(
    '/settings',
    requireUser,
    jsonBody(changeSettingsRequest),
    async (c) => {
      const { userId } = c.var;
      const { timeZone, activityGoal, entryGoal, defaultCadence, ...preferences } =
        c.req.valid('json');
      const now = clock.now();
      const settings = await withUser(userId, async (tx) => {
        // Goals first: “from tomorrow” is read in the time zone in effect today.
        if (activityGoal !== undefined) await changeActivityGoal(tx, userId, activityGoal, now);
        if (entryGoal !== undefined) await changeEntryGoal(tx, userId, entryGoal, now);
        if (timeZone !== undefined) await changeTimeZone(tx, userId, timeZone, now);
        const changed = {
          ...preferences,
          ...(defaultCadence && {
            followUpIntervals: defaultCadence.intervals,
            responseWindowDays: defaultCadence.responseWindowDays,
          }),
        };
        if (Object.keys(changed).length > 0) {
          await tx.update(userSettings).set(changed).where(eq(userSettings.userId, userId));
        }
        return settingsOf(tx, userId, now);
      });
      return c.json({ settings }, 200);
    },
  );
  return { routes };
}
