import {
  CONTACT_STATUSES,
  STATUS_REASON_MAX_LENGTH,
  type ContactStatus,
} from '@battlecrm/contract';
import { addDays, funnelEntriesInWeek } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { Form, TextField } from 'react-aria-components';
import { z } from 'zod';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Input, invalidInputClass } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useLocale, type Locale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { applySummaryChanges, SUMMARY_KEY, type Summary, type SummaryContact } from '../summary.ts';
import { notifyGesture } from '../undo.tsx';
import { todayOf } from './follow-up.tsx';
import { formatLocalDay } from './format.ts';
import { otherStatuses, STATUS_ACTION, type StatusGesture } from './status.ts';

/**
 * The change of Status open on the record, carried by the address (ST-70): `open` shows its panel,
 * `close` takes it away.
 */
export function useStatusGesture() {
  const { statusTo } = useSearch({ strict: false });
  const navigate = useNavigate();
  return {
    gesture: statusTo,
    open: (gesture: StatusGesture) =>
      void navigate({ to: '.', search: (search) => ({ ...search, statusTo: gesture }) }),
    close: () =>
      void navigate({
        to: '.',
        search: ({ statusTo: _closed, ...search }) => search,
        replace: true,
      }),
  };
}

const TITLE: Record<StatusGesture, (inputs: { name: string }) => string> = {
  choose: m.change_status_title_choose,
  prospecting: m.change_status_title_prospecting,
  ally: m.change_status_title_ally,
  pool: m.change_status_title_pool,
  archived: m.change_status_title_archived,
};

/** What the panel keeps while it is open: the target when it was to be chosen, the Stage, the reason. */
const draftSchema = z.object({
  target: z.enum(CONTACT_STATUSES).optional(),
  stageId: z.string().optional(),
  reason: z.string(),
});
type Draft = z.infer<typeof draftSchema>;

/**
 * Bring in…, Back to Pool…, Add to Circle…, Archive…, or Change status… which chooses the target
 * first (spec UX §6.11): one panel, set to its target. The Stage to enter, the reason, the summary;
 * `Enter` validates, then “Undo”. Settling the Trial in progress comes with Trials (ticket 29).
 */
export function ChangeStatusPanel({
  contact,
  summary,
  gesture,
  onClose,
}: {
  contact: SummaryContact;
  summary: Summary;
  gesture: StatusGesture;
  onClose: () => void;
}) {
  const locale = useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  // A target the Contact already has, from an address kept from before, is to be chosen again.
  const opened: StatusGesture = gesture === contact.status ? 'choose' : gesture;
  const lastStage = summary.stages.find(({ id }) => id === contact.stageId);
  const [draft, setDraft, clearDraft] = useSessionDraft<Draft>(
    `change-status:${contact.id}:${opened}`,
    { stageId: enteredStageOf(contact, summary), reason: '' },
    draftSchema,
  );
  const target = opened === 'choose' ? draft.target : opened;
  const [wasSent, setWasSent] = useState(false);
  const stageId = stageInFunnel(summary, draft.stageId);
  const isStageMissing = target === 'prospecting' && stageId === undefined;

  const close = () => {
    clearDraft();
    onClose();
  };

  const change = useMutation({
    mutationFn: async (to: ContactStatus) => {
      const reason = draft.reason.trim();
      const response = await api.contacts[':id']['change-status'].$post({
        param: { id: contact.id },
        json: {
          status: to,
          ...(to === 'prospecting' && stageId !== undefined && { stageId }),
          ...(reason !== '' && { reason }),
        },
      });
      // Refusals of data this device is behind on, changed on another one: read the summary again.
      if (response.status === 400 || response.status === 404 || response.status === 409) {
        const { error } = await response.json();
        if (error === 'stage_required' || error === 'unknown_stage') return 'stage_gone' as const;
        if (error !== 'invalid') return 'behind' as const;
      }
      if (!response.ok) throw new Error('POST /api/contacts/:id/change-status failed');
      return response.json();
    },
    onSuccess: async (answer, to) => {
      if (typeof answer === 'string') {
        if (answer === 'stage_gone') setDraft({ ...draft, stageId: undefined });
        await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
        return;
      }
      const { changes, undoToken } = answer;
      await applySummaryChanges(queryClient, changes);
      const [changed] = changes.contacts;
      if (changed) notifyGesture(statusChangedMessage(changed, to, summary), undoToken);
      close();
    },
  });

  /** The summary of what the change does (spec UX §1, §6.11). */
  const recap = target === undefined ? [] : statusRecap(target, summary, locale);
  if (target === 'ally' && contact.status === 'prospecting' && lastStage) {
    recap.push(m.change_status_keeps_stage({ stage: lastStage.name }));
  }
  // Leaving Prospecting, or going to the Pool or Archived, cancels it (CONTEXT.md, Follow-up).
  if (target !== undefined && target !== 'prospecting' && contact.followUp) {
    recap.push(
      m.change_status_cancels_follow_up({ date: formatLocalDay(contact.followUp.dueOn, locale) }),
    );
  }

  return (
    <GesturePanel title={TITLE[opened]({ name: contact.name })} onClose={close}>
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- `Enter` validates from any field (spec UX §6.11): a list of Stages or a choice of target would not submit by itself. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.target instanceof HTMLButtonElement) return;
          if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
          event.preventDefault();
          formRef.current?.requestSubmit();
        }}
      >
        <Form
          className="flex min-h-0 flex-1 flex-col"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            setWasSent(true);
            if (target === undefined || isStageMissing || change.isPending) return;
            change.mutate(target);
          }}
        >
          <GesturePanelBody>
            {opened === 'choose' && (
              <SegmentedControl
                value={draft.target ?? null}
                onChange={(value) => {
                  const chosen = CONTACT_STATUSES.find((candidate) => candidate === value);
                  if (chosen) setDraft({ ...draft, target: chosen });
                }}
              >
                <Label>{m.change_status_target()}</Label>
                <SegmentedControlItems className="flex-wrap">
                  {otherStatuses(contact.status).map((candidate) => (
                    <SegmentedControlItem key={candidate} value={candidate}>
                      {STATUS_ACTION[candidate]()}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControlItems>
              </SegmentedControl>
            )}
            {target === 'prospecting' && (
              <StageField
                summary={summary}
                stageId={stageId}
                onChange={(chosen) => setDraft({ ...draft, stageId: chosen })}
                isMissing={wasSent && isStageMissing}
                takesFocus={opened !== 'choose'}
              />
            )}
            {target !== undefined && (
              <TextField
                name="reason"
                value={draft.reason}
                onChange={(reason) => setDraft({ ...draft, reason })}
                maxLength={STATUS_REASON_MAX_LENGTH}
                className="flex flex-col gap-1.5"
              >
                <Label>{m.change_status_reason()}</Label>
                <Input
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its first field takes the focus, which closing gives back.
                  autoFocus={opened !== 'choose' && target !== 'prospecting'}
                  className="max-md:h-11"
                />
              </TextField>
            )}
            {recap.length > 0 && (
              <section aria-label={m.change_status_recap()} className="rounded-control border p-3">
                <ul className="list-disc pl-5">
                  {recap.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            )}
            <ErrorMessage>
              {change.isError
                ? m.auth_error()
                : (change.data === 'stage_gone' && m.contact_stage_gone()) ||
                  (change.data === 'behind' && m.change_status_behind())}
            </ErrorMessage>
          </GesturePanelBody>
          <GesturePanelFooter>
            <Button
              type="submit"
              className="max-md:min-h-11"
              isDisabled={target === undefined || change.isPending}
            >
              {target === undefined ? m.change_status_validate() : STATUS_ACTION[target]()}
            </Button>
          </GesturePanelFooter>
        </Form>
      </div>
    </GesturePanel>
  );
}

/** The Stage a Contact enters by default: the last one it reached, unless it is archived or there is none. */
export function enteredStageOf(contact: SummaryContact, summary: Summary) {
  const last = summary.stages.find(({ id }) => id === contact.stageId);
  return last && !last.archived ? last.id : undefined;
}

/** The Stage chosen, while the Funnel still has it: archived meanwhile, it is to be chosen again. */
export const stageInFunnel = (summary: Summary, stageId: string | undefined) =>
  summary.stages.some(({ id, archived }) => id === stageId && !archived) ? stageId : undefined;

/** The Stage a Contact enters the Funnel at, among the ones not archived; required when none is chosen. */
export function StageField({
  summary,
  stageId,
  onChange,
  isMissing,
  takesFocus = false,
}: {
  summary: Summary;
  stageId: string | undefined;
  onChange: (stageId: string | undefined) => void;
  isMissing: boolean;
  takesFocus?: boolean;
}) {
  const fieldId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{m.contact_stage()}</Label>
      <select
        id={fieldId}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened to enter the Funnel: its first field takes the focus, which closing gives back.
        autoFocus={takesFocus}
        value={stageId ?? ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        aria-invalid={isMissing}
        aria-describedby={isMissing ? errorId : undefined}
        className={cn(
          'h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm',
          isMissing && invalidInputClass,
        )}
      >
        {stageId === undefined && <option value="">{m.change_status_choose_stage()}</option>}
        {summary.stages
          .filter((stage) => !stage.archived)
          .map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
      </select>
      {isMissing && (
        <div id={errorId}>
          <ErrorMessage>{m.change_status_stage_required()}</ErrorMessage>
        </div>
      )}
    </div>
  );
}

/**
 * What entering the Funnel or the Circle counts (spec UX §6.11): the Funnel entry of this week against
 * its goal, the Circle against its size goal and the next check-in, a Rhythm after the last Interaction
 * done (today unless said otherwise). Nothing for the other Statuses.
 */
export function statusRecap(
  to: ContactStatus,
  summary: Summary,
  locale: Locale,
  lastDoneOn?: string,
): string[] {
  const today = todayOf(summary);
  // The Entry goal of this week, whatever the User chose for the next ones; either may be off.
  const settings = settingsOf(summary);
  if (to === 'prospecting') {
    const count = funnelEntriesInWeek(summary.contacts, today) + 1;
    const goal = settings.entryGoal.inEffect;
    return [
      goal === null
        ? m.change_status_entry_recap_no_goal({ count })
        : m.change_status_entry_recap({ count, goal }),
    ];
  }
  if (to !== 'ally') return [];
  const count = circleCountAfter(summary);
  const goal = settings.circleSizeGoal;
  const days = settings.checkInRhythmDays;
  const date = formatLocalDay(addDays(lastDoneOn ?? today, days), locale);
  return [
    goal === null
      ? m.change_status_circle_recap_no_goal({ count, date, days })
      : m.change_status_circle_recap({ count, goal, date, days }),
  ];
}

/** The Allies once one more joins the Circle. */
const circleCountAfter = (summary: Summary) =>
  summary.contacts.filter(({ status }) => status === 'ally').length + 1;

/** What the notification of a change of Status says (spec UX §10), with the counts the summary showed before it. */
export function statusChangedMessage(
  changed: SummaryContact,
  to: ContactStatus,
  summary: Summary,
): string {
  const { name } = changed;
  const settings = settingsOf(summary);
  switch (to) {
    case 'prospecting': {
      const stage = summary.stages.find(({ id }) => id === changed.stageId)?.name ?? '';
      const count = funnelEntriesInWeek(summary.contacts, todayOf(summary)) + 1;
      const goal = settings.entryGoal.inEffect;
      return goal === null
        ? m.status_changed_prospecting_no_goal({ name, stage, count })
        : m.status_changed_prospecting({ name, stage, count, goal });
    }
    case 'ally': {
      const count = circleCountAfter(summary);
      const goal = settings.circleSizeGoal;
      return goal === null
        ? m.status_changed_ally_no_goal({ name, count })
        : m.status_changed_ally({ name, count, goal });
    }
    case 'pool':
      return m.status_changed_pool({ name });
    default:
      return m.status_changed_archived({ name });
  }
}
