import { celebration as celebrationAnswer } from '@battlecrm/contract';
import { activityGoalReached, activityOn } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { notify } from '../components/ui/toast.tsx';
import { useApi } from '../session.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { celebratedOnOf, SUMMARY_KEY, todayOf, type Summary } from '../summary.ts';

// The celebration of the Activity goal reached (spec UX §2, ST-44): once a day, on every device, at
// the gesture of this device that brings the Activity of the day to its goal.

/** A point of the window, where the gesture was done: what the confetti start from. */
type Origin = { x: number; y: number };
/** A gesture that brought the Activity of the day to its goal, and what it counts now. */
type Crossing = { origin: Origin | null; activity: number; goal: number };

const crossings = new Set<(crossing: Crossing) => void>();

/** About how long the confetti fly, and the halo of the Activity shows (spec UX §2). */
const CELEBRATION_MS = 1500;

/** The middle of the control a gesture was done with: the confetti start there. */
export function originOf(element: Element | null): Origin | null {
  if (!element || element === document.body) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
}

/**
 * After a gesture of this device, with the summary before and after its rows went in: when the
 * Activity of today crossed its goal, the celebration is asked for, unless turned off or already
 * celebrated today, as far as this device knows.
 */
export function celebrateIfReached(
  before: Summary | undefined,
  after: Summary | undefined,
  origin: Origin | null,
): void {
  if (!before || !after) return;
  const today = todayOf(after);
  const { activityGoal, celebrateGoal } = settingsOf(after);
  const goal = activityGoal.inEffect;
  if (goal === null || !celebrateGoal || celebratedOnOf(after) === today) return;
  const activity = activityOn(after.contacts, today);
  const crossed =
    !activityGoalReached(activityOn(before.contacts, today), goal) &&
    activityGoalReached(activity, goal);
  if (!crossed) return;
  for (const listener of crossings) listener({ origin, activity, goal });
}

// Whether the Activity shows its halo: for a moment, after a celebration.
let haloUntil = 0;
const haloListeners = new Set<() => void>();
const showHalo = () => {
  haloUntil = Date.now() + CELEBRATION_MS;
  for (const listener of haloListeners) listener();
  setTimeout(() => {
    for (const listener of haloListeners) listener();
  }, CELEBRATION_MS);
};

/** Whether the Activity of the day shows its halo: briefly, as its goal is celebrated (spec UX §2). */
export function useHalo(): boolean {
  return useSyncExternalStore(
    (listener) => {
      haloListeners.add(listener);
      return () => haloListeners.delete(listener);
    },
    () => Date.now() < haloUntil,
  );
}

/** The colours of the confetti: teal, green and grey, from the tokens of the theme (ST-68). */
const CONFETTI_COLOURS = ['var(--accent-text)', 'var(--success)', 'var(--neutral-dot)'];
const CONFETTI_COUNT = 40;

/** About forty thin confetti that burst from a point and fall away: decoration, hidden from assistive technology. */
function throwConfetti(origin: Origin | null) {
  const { x, y } = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const layer = document.createElement('div');
  layer.dataset['confetti'] = '';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:60';
  const flights = Array.from({ length: CONFETTI_COUNT }, (_, index) => {
    const piece = document.createElement('span');
    piece.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:4px;height:9px;border-radius:1px;background:${CONFETTI_COLOURS[index % CONFETTI_COLOURS.length]}`;
    layer.append(piece);
    // Upwards and to the sides, then down under their weight.
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 90 + Math.random() * 130;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed;
    const spin = (Math.random() - 0.5) * 720;
    return piece.animate(
      [
        { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin / 2}deg)`,
          opacity: 1,
          offset: 0.45,
        },
        {
          transform: `translate(calc(-50% + ${dx * 1.3}px), calc(-50% + ${dy + 160}px)) rotate(${spin}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: CELEBRATION_MS * (0.8 + Math.random() * 0.2),
        easing: 'cubic-bezier(.2,.6,.4,1)',
      },
    );
  });
  document.body.append(layer);
  void Promise.allSettled(flights.map((flight) => flight.finished)).then(() => layer.remove());
}

/**
 * The celebration, rendered once by the shell: a crossing is asked of the API, which says whether this
 * device celebrates, the first that day (ST-44). Then the confetti, unless the system asks for less
 * motion (ST-69), the halo of the Activity, and the notification, announced politely (spec UX §7).
 */
export function Celebration() {
  const api = useApi();
  const queryClient = useQueryClient();
  useEffect(() => {
    const onCrossing = async ({ origin, activity, goal }: Crossing) => {
      const response = await api.today.celebration.$post();
      if (!response.ok) return;
      const { celebrate, celebratedOn } = celebrationAnswer.parse(await response.json());
      queryClient.setQueryData<Summary>(
        SUMMARY_KEY,
        (summary) => summary && { ...summary, celebratedOn },
      );
      if (!celebrate) return;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) throwConfetti(origin);
      showHalo();
      notify({ message: m.today_celebration({ count: activity, goal }) });
    };
    const listener = (crossing: Crossing) => void onCrossing(crossing).catch(() => undefined);
    crossings.add(listener);
    return () => {
      crossings.delete(listener);
    };
  }, [api, queryClient]);
  return null;
}
