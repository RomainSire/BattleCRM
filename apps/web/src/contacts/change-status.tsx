import {
  CONTACT_STATUSES,
  STATUS_REASON_MAX_LENGTH,
  type ContactStatus,
} from '@battlecrm/contract';
import { addDays, funnelEntriesInWeek, localDay } from '@battlecrm/domain';
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
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { settingsOf } from '../settings/use-settings.ts';
import { applySummaryChanges, SUMMARY_KEY, type Summary, type SummaryContact } from '../summary.ts';
import { notifyGesture } from '../undo.tsx';
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

/** Today for the User, in its time zone: what the Funnel entries and the Circle are counted from. */
const todayOf = (summary: Summary) => localDay(new Date(), summary.timeZone);

/**
 * Bring in…, Back to Pool…, Add to Circle…, Archive…, or Change status… which chooses the target
 * first (spec UX §6.11): one panel, set to its target. The Stage to enter, the reason, the summary;
 * `Enter` validates, then “Undo”. Settling the Trial in progress comes with Trials (ticket 29), and
 * the scheduled Follow-up with Follow-ups (ticket 21).
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
  const stageFieldId = useId();
  const stageErrorId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  // A target the Contact already has, from an address kept from before, is to be chosen again.
  const opened: StatusGesture = gesture === contact.status ? 'choose' : gesture;
  const funnel = summary.stages.filter((stage) => !stage.archived);
  const lastStage = summary.stages.find(({ id }) => id === contact.stageId);
  const [draft, setDraft, clearDraft] = useSessionDraft<Draft>(
    `change-status:${contact.id}:${opened}`,
    // The last Stage reached, unless it is archived or there is none: then one must be chosen.
    { stageId: lastStage && !lastStage.archived ? lastStage.id : undefined, reason: '' },
    draftSchema,
  );
  const target = opened === 'choose' ? draft.target : opened;
  const [wasSent, setWasSent] = useState(false);
  const today = todayOf(summary);
  const entryNumber = funnelEntriesInWeek(summary.contacts, today) + 1;
  const circleCount = summary.contacts.filter(({ status }) => status === 'ally').length + 1;
  // The Entry goal of this week, whatever the User chose for the next ones; either may be off.
  const settings = settingsOf(summary);
  const entryGoal = settings.entryGoal.inEffect;
  const circleGoal = settings.circleSizeGoal;
  const rhythm = settings.checkInRhythmDays;
  const stageId = funnel.some(({ id }) => id === draft.stageId) ? draft.stageId : undefined;
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
      if (changed) notifyGesture(changedMessage(changed, to), undoToken);
      close();
    },
  });

  /** What the notification says (spec UX §10), with the counts the summary showed. */
  function changedMessage(changed: SummaryContact, to: ContactStatus): string {
    const { name } = changed;
    switch (to) {
      case 'prospecting': {
        const stage = summary.stages.find(({ id }) => id === changed.stageId)?.name ?? '';
        return entryGoal === null
          ? m.status_changed_prospecting_no_goal({ name, stage, count: entryNumber })
          : m.status_changed_prospecting({ name, stage, count: entryNumber, goal: entryGoal });
      }
      case 'ally':
        return circleGoal === null
          ? m.status_changed_ally_no_goal({ name, count: circleCount })
          : m.status_changed_ally({ name, count: circleCount, goal: circleGoal });
      case 'pool':
        return m.status_changed_pool({ name });
      default:
        return m.status_changed_archived({ name });
    }
  }

  /** The summary of what the change does (spec UX §1, §6.11). */
  const recap: string[] = [];
  if (target === 'prospecting') {
    recap.push(
      entryGoal === null
        ? m.change_status_entry_recap_no_goal({ count: entryNumber })
        : m.change_status_entry_recap({ count: entryNumber, goal: entryGoal }),
    );
  }
  if (target === 'ally') {
    const nextCheckIn = formatLocalDay(addDays(today, rhythm), locale);
    recap.push(
      circleGoal === null
        ? m.change_status_circle_recap_no_goal({
            count: circleCount,
            date: nextCheckIn,
            days: rhythm,
          })
        : m.change_status_circle_recap({
            count: circleCount,
            goal: circleGoal,
            date: nextCheckIn,
            days: rhythm,
          }),
    );
  }
  if (target === 'ally' && contact.status === 'prospecting' && lastStage) {
    recap.push(m.change_status_keeps_stage({ stage: lastStage.name }));
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={stageFieldId}>{m.contact_stage()}</Label>
                <select
                  id={stageFieldId}
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened to enter the Funnel: its first field takes the focus, which closing gives back.
                  autoFocus={opened !== 'choose'}
                  value={stageId ?? ''}
                  onChange={(event) =>
                    setDraft({ ...draft, stageId: event.target.value || undefined })
                  }
                  aria-invalid={wasSent && isStageMissing}
                  aria-describedby={wasSent && isStageMissing ? stageErrorId : undefined}
                  className={cn(
                    'h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm',
                    wasSent && isStageMissing && invalidInputClass,
                  )}
                >
                  {stageId === undefined && (
                    <option value="">{m.change_status_choose_stage()}</option>
                  )}
                  {funnel.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                {wasSent && isStageMissing && (
                  <div id={stageErrorId}>
                    <ErrorMessage>{m.change_status_stage_required()}</ErrorMessage>
                  </div>
                )}
              </div>
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
