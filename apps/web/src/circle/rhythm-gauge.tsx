import { CHECK_IN_SOON_DAYS, type AllySignal } from '@battlecrm/domain';
import { cn } from 'cn';

/** The colour of each signal: neutral, light amber, amber; never red (spec UX §2). */
const FILL: Record<AllySignal['signal'], string> = {
  none: 'bg-neutral-text',
  soon: 'bg-soon-gauge',
  'time-to-check-in': 'bg-overdue',
};

/**
 * The gauge of the Check-in rhythm (spec UX §5.11): filled over the Rhythm, a mark where “soon”
 * starts. Decorative: its tier and its Days since contact are always written next to it (spec UX §7).
 */
export function RhythmGauge({
  signal,
  rhythmDays,
  className,
}: {
  signal: AllySignal;
  rhythmDays: number;
  className?: string;
}) {
  const filled = Math.min(signal.daysSinceContact / rhythmDays, 1);
  const soonFrom = Math.max(rhythmDays - CHECK_IN_SOON_DAYS, 0) / rhythmDays;
  return (
    <div
      aria-hidden="true"
      data-rhythm-gauge={signal.signal}
      // Never in the way of the row it is drawn on, which opens the record.
      className={cn(
        'pointer-events-none relative h-1.5 w-full overflow-hidden rounded-full bg-border',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full', FILL[signal.signal])}
        style={{ width: `${filled * 100}%` }}
      />
      {soonFrom > 0 && (
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${soonFrom * 100}%` }}
        />
      )}
    </div>
  );
}
