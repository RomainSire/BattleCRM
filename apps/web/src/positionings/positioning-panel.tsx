import {
  CHANNELS,
  FOLLOW_UP_INTERVALS_MAX,
  FOLLOW_UP_MESSAGE_MAX_LENGTH,
  POSITIONING_CONTENT_MAX_LENGTH,
  POSITIONING_LABEL_MAX_LENGTH,
  SETTING_DAYS_MAX,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Form, NumberField, TextField } from 'react-aria-components';
import { z } from 'zod';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import {
  GesturePanel,
  GesturePanelBody,
  GesturePanelFooter,
} from '../components/ui/gesture-panel.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { Textarea } from '../components/ui/textarea.tsx';
import { CHANNEL_LABEL } from '../channel.ts';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { useSessionDraft } from '../session-draft.ts';
import { useSettings } from '../settings/use-settings.ts';
import {
  attachmentsOf,
  type Summary,
  type SummaryChanges,
  type SummaryPositioning,
} from '../summary.ts';

/** The panels of the workshop, carried by the address (ST-70). */
export const POSITIONING_PANELS = ['new', 'edit', 'copy', 'relabel'] as const;
export type PositioningPanelKind = (typeof POSITIONING_PANELS)[number];

/**
 * What stands for the first name of the Contact in what is sent, in the language of the User: the
 * use of a Positioning (ticket 25) replaces either.
 */
const FIRST_NAME_TOKEN = { fr: '{prénom}', en: '{first name}' } as const;

/** What the workshop writes in a Positioning (spec UX §6.10). */
type Fields = {
  label: string;
  channel: (typeof CHANNELS)[number];
  content?: string;
  followUps: { days: number; message?: string }[];
  responseWindowDays: number;
};

/** What a panel of the workshop may be refused with: fixing a label, as editing. */
type PanelRefusal =
  | RefusalOf<ApiClient['positionings']['$post']>
  | RefusalOf<ApiClient['positionings'][':id']['edit']['$post']>;

/**
 * What a refusal tells the User: a Stage gone or no room left are theirs to read; anything else, a
 * Positioning changed elsewhere.
 */
function refusalText(refused: PanelRefusal | undefined) {
  if (refused === undefined) return undefined;
  if (refused.error === 'unknown_stage') return m.contact_stage_gone();
  if (refused.error === 'quota_exceeded') return m.positioning_attachment_quota_exceeded();
  return m.positioning_behind();
}

const positioningDraft = z.object({
  stageId: z.string(),
  label: z.string(),
  channel: z.enum(CHANNELS),
  content: z.string(),
  followUps: z.array(z.object({ days: z.number(), message: z.string() })),
  responseWindowDays: z.number(),
});
type PositioningDraft = z.infer<typeof positioningDraft>;

/** A Positioning as the panel edits it: every rank with a message, blank when it has none. */
const draftOf = (positioning: SummaryPositioning): PositioningDraft => ({
  stageId: positioning.stageId,
  label: positioning.label,
  channel: positioning.channel,
  content: positioning.content ?? '',
  followUps: positioning.followUps.map(({ days, message }) => ({ days, message: message ?? '' })),
  responseWindowDays: positioning.responseWindowDays,
});

/** What the panel sends: blanks left out. */
const fieldsOf = (draft: PositioningDraft): Fields => ({
  label: draft.label.trim(),
  channel: draft.channel,
  ...(draft.content.trim() !== '' && { content: draft.content }),
  followUps: draft.followUps.map(({ days, message }) => ({
    days,
    ...(message.trim() !== '' && { message }),
  })),
  responseWindowDays: draft.responseWindowDays,
});

/**
 * Where the panel leads back to when another journey opened it (spec UX §6.10): the opening of a
 * Battle (ticket 27) or the use of a Positioning (ticket 25). Its Stage is then locked.
 */
export type PositioningPanelReturn = {
  createLabel: string;
  cancelLabel: string;
  onCreated: (positioningId: string) => void;
  onCanceled: () => void;
};

/**
 * Create a Positioning or a modified copy, or edit one never frozen (spec UX §6.10): its Stage, label,
 * Channel, what is sent and its Follow-up cadence, filled in with the Default follow-up cadence or
 * with the original.
 */
export function PositioningPanel({
  kind,
  summary,
  stageId,
  source,
  onClose,
  onSaved,
  back,
}: {
  kind: 'new' | 'edit' | 'copy';
  summary: Summary;
  /** The Stage of a new one, as chosen in the workshop. */
  stageId: string;
  /** The Positioning edited, or copied. */
  source: SummaryPositioning | undefined;
  onClose: () => void;
  onSaved: (positioningId: string) => void;
  back?: PositioningPanelReturn;
}) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const { defaultCadence } = useSettings();
  const cadenceId = useId();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const initial: PositioningDraft = source
    ? draftOf(source)
    : {
        stageId,
        label: '',
        channel: 'email',
        content: '',
        followUps: defaultCadence.intervals.map((days) => ({ days, message: '' })),
        responseWindowDays: defaultCadence.responseWindowDays,
      };
  const [draft, setDraft, clearDraft] = useSessionDraft(
    `positioning:${kind}:${source?.id ?? stageId}`,
    initial,
    positioningDraft,
  );
  const [wasSent, setWasSent] = useState(false);
  const close = () => {
    clearDraft();
    if (back) back.onCanceled();
    else onClose();
  };
  const save = useMutation({
    mutationFn: async () => {
      const fields = fieldsOf(draft);
      // The Positioning saved: the one created, or the one edited.
      let saved = source?.id;
      const message = ({ positionings: [changed] }: SummaryChanges) => {
        saved = changed?.id ?? saved;
        return {
          new: m.positioning_created_toast,
          edit: m.positioning_saved_toast,
          copy: m.positioning_copy_created_toast,
        }[kind]({ label: fields.label });
      };
      let refused: PanelRefusal | undefined;
      if (kind === 'edit' && source) {
        const { channel: _fixed, ...edited } = fields;
        refused = await sendGesture(
          api.positionings[':id'].edit.$post({ param: { id: source.id }, json: edited }),
          message,
        );
      } else {
        refused = await sendGesture(
          api.positionings.$post({
            json: {
              ...fields,
              stageId: draft.stageId,
              ...(kind === 'copy' && source && { derivedFromId: source.id }),
            },
          }),
          message,
        );
      }
      return { refused, saved };
    },
    onSuccess: ({ refused, saved }) => {
      if (refused) return;
      clearDraft();
      if (saved === undefined) return;
      if (back && kind !== 'edit') back.onCreated(saved);
      else onSaved(saved);
    },
  });

  const isStageLocked = kind !== 'new' || back !== undefined;
  const stageName = summary.stages.find(({ id }) => id === draft.stageId)?.name;
  const title = {
    new: () => m.positioning_new_title(),
    edit: () => m.positioning_edit_title({ label: source?.label ?? '' }),
    copy: () => m.positioning_copy_title({ label: source?.label ?? '' }),
  }[kind]();
  const setFollowUp = (rank: number, followUp: { days: number; message: string }) =>
    setDraft({ ...draft, followUps: draft.followUps.with(rank, followUp) });
  const token = FIRST_NAME_TOKEN[locale];
  const insertFirstName = () => {
    const field = contentRef.current;
    const at = field?.selectionStart ?? draft.content.length;
    const end = field?.selectionEnd ?? at;
    setDraft({ ...draft, content: draft.content.slice(0, at) + token + draft.content.slice(end) });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(at + token.length, at + token.length);
    });
  };
  let validateLabel = m.positioning_create;
  if (kind === 'edit') validateLabel = m.positioning_save;
  if (kind === 'copy') validateLabel = m.positioning_create_copy_validate;

  return (
    <GesturePanel title={title} onClose={close}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (draft.label.trim() !== '' && !save.isPending) save.mutate();
        }}
      >
        <GesturePanelBody>
          {kind === 'copy' && <p className="text-muted-foreground">{m.positioning_copy_note()}</p>}
          {kind === 'copy' && source && attachmentsOf(source).length > 0 && (
            <p className="text-muted-foreground">
              {m.positioning_copy_attachments({ count: attachmentsOf(source).length })}
            </p>
          )}
          {isStageLocked ? (
            <p>
              <span className="text-muted-foreground">{m.positioning_stage()} · </span>
              <span className="font-medium">{stageName}</span>
            </p>
          ) : (
            <StageSelect
              summary={summary}
              stageId={draft.stageId}
              onChange={(chosen) => setDraft({ ...draft, stageId: chosen })}
            />
          )}
          <TextField
            value={draft.label}
            onChange={(label) => setDraft({ ...draft, label })}
            maxLength={POSITIONING_LABEL_MAX_LENGTH}
            isInvalid={wasSent && draft.label.trim() === ''}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.positioning_label()}</Label>
            <Input
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its first field takes the focus, which closing gives back.
              autoFocus
              placeholder={m.positioning_label_placeholder()}
              className="max-md:h-11"
            />
            <FieldErrorMessage>{m.positioning_label_required()}</FieldErrorMessage>
          </TextField>
          {/* Another Channel is another Positioning (CONTEXT.md): fixed once created. */}
          {kind === 'edit' ? (
            <p>
              <span className="text-muted-foreground">{m.positioning_channel()} · </span>
              <span className="font-medium">{CHANNEL_LABEL[draft.channel]()}</span>
            </p>
          ) : (
            <SegmentedControl
              value={draft.channel}
              onChange={(value) => {
                const channel = CHANNELS.find((candidate) => candidate === value);
                if (channel) setDraft({ ...draft, channel });
              }}
            >
              <Label>{m.positioning_channel()}</Label>
              <SegmentedControlItems className="flex-wrap">
                {CHANNELS.map((channel) => (
                  <SegmentedControlItem key={channel} value={channel}>
                    {CHANNEL_LABEL[channel]()}
                  </SegmentedControlItem>
                ))}
              </SegmentedControlItems>
              <p className="text-sm text-muted-foreground">{m.positioning_channel_hint()}</p>
            </SegmentedControl>
          )}
          <TextField
            value={draft.content}
            onChange={(content) => setDraft({ ...draft, content })}
            maxLength={POSITIONING_CONTENT_MAX_LENGTH}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.positioning_what_you_send()}</Label>
            <Textarea ref={contentRef} className="min-h-28" />
          </TextField>
          <p className="-mt-2 text-sm text-muted-foreground">
            <Button variant="link" className="h-auto p-0 max-md:min-h-11" onPress={insertFirstName}>
              {m.positioning_insert_first_name({ token })}
            </Button>{' '}
            · {m.positioning_first_name_hint()}
          </p>
          <section aria-labelledby={cadenceId} className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 id={cadenceId} className="text-sm font-medium">
                {m.positioning_follow_ups()}
              </h3>
              <p className="text-sm text-muted-foreground">
                {source
                  ? m.positioning_prefilled_from({ label: source.label })
                  : m.positioning_prefilled_default()}{' '}
                {m.positioning_counted_from()}
              </p>
            </div>
            <ol className="flex flex-col gap-3">
              {draft.followUps.map((followUp, rank) => (
                // The rank is the identity of a Follow-up: removing one renumbers those after it.
                // oxlint-disable-next-line react/no-array-index-key
                <li key={rank} className="flex items-start gap-2">
                  <DaysField
                    label={m.positioning_follow_up_days({ rank: rank + 1 })}
                    value={followUp.days}
                    onChange={(days) => setFollowUp(rank, { ...followUp, days })}
                  />
                  <TextField
                    value={followUp.message}
                    onChange={(message) => setFollowUp(rank, { ...followUp, message })}
                    maxLength={FOLLOW_UP_MESSAGE_MAX_LENGTH}
                    className="flex min-w-0 flex-1 flex-col gap-1.5"
                  >
                    <Label>{m.positioning_follow_up_message({ rank: rank + 1 })}</Label>
                    <Textarea rows={1} className="min-h-8" />
                  </TextField>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="mt-6 max-md:size-11"
                    aria-label={m.positioning_remove_follow_up({ rank: rank + 1 })}
                    onPress={() =>
                      setDraft({ ...draft, followUps: draft.followUps.toSpliced(rank, 1) })
                    }
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ol>
            {draft.followUps.length < FOLLOW_UP_INTERVALS_MAX && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit max-md:min-h-11"
                onPress={() =>
                  setDraft({
                    ...draft,
                    followUps: [
                      ...draft.followUps,
                      { days: draft.followUps.at(-1)?.days ?? 3, message: '' },
                    ],
                  })
                }
              >
                <Plus aria-hidden />
                {m.positioning_add_follow_up()}
              </Button>
            )}
            <DaysField
              label={m.positioning_response_window_days()}
              hint={m.positioning_response_window_hint()}
              value={draft.responseWindowDays}
              onChange={(responseWindowDays) => setDraft({ ...draft, responseWindowDays })}
            />
          </section>
          {kind === 'new' && (
            <p className="text-sm text-muted-foreground">
              {m.positioning_attachments_after_creation()}
            </p>
          )}
          {kind !== 'edit' && (
            <p className="text-sm text-muted-foreground">{m.positioning_freezes_note()}</p>
          )}
          <ErrorMessage>
            {save.isError ? m.auth_error() : refusalText(save.data?.refused)}
          </ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          <Button variant="outline" className="max-md:min-h-11" onPress={close}>
            {back ? back.cancelLabel : m.cancel()}
          </Button>
          <Button type="submit" className="max-md:min-h-11" isDisabled={save.isPending}>
            {back && kind !== 'edit' ? back.createLabel : validateLabel()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}

/** The Stages a Positioning may be created at: those of the Funnel. */
function StageSelect({
  summary,
  stageId,
  onChange,
}: {
  summary: Summary;
  stageId: string;
  onChange: (stageId: string) => void;
}) {
  const fieldId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{m.positioning_stage()}</Label>
      <select
        id={fieldId}
        value={stageId}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm"
      >
        {summary.stages
          .filter((stage) => !stage.archived)
          .map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
      </select>
    </div>
  );
}

/** A number of days, from 1 to a year: emptied, it goes back to its value. */
function DaysField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <NumberField
      value={value}
      minValue={1}
      maxValue={SETTING_DAYS_MAX}
      step={1}
      formatOptions={{ maximumFractionDigits: 0 }}
      onChange={(days) => {
        if (!Number.isNaN(days)) onChange(days);
      }}
      className="flex flex-col gap-1.5"
    >
      <Label>{label}</Label>
      <Input className="w-24 max-md:h-11" />
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </NumberField>
  );
}

/**
 * Fix the label (spec UX §5.6): for a typo, even once frozen; the new label applies everywhere.
 */
export function RelabelPanel({
  positioning,
  onClose,
}: {
  positioning: SummaryPositioning;
  onClose: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  const [label, setLabel] = useState(positioning.label);
  const [wasSent, setWasSent] = useState(false);
  const relabel = useMutation({
    mutationFn: () =>
      sendGesture(
        api.positionings[':id'].relabel.$post({
          param: { id: positioning.id },
          json: { label: label.trim() },
        }),
        () => m.positioning_relabeled_toast({ label: label.trim() }),
      ),
    onSuccess: (refused) => {
      if (!refused) onClose();
    },
  });
  return (
    <GesturePanel title={m.positioning_relabel()} onClose={onClose}>
      <Form
        className="flex min-h-0 flex-1 flex-col"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          setWasSent(true);
          if (label.trim() !== '' && !relabel.isPending) relabel.mutate();
        }}
      >
        <GesturePanelBody>
          <p className="text-muted-foreground">{m.positioning_relabel_hint()}</p>
          <TextField
            value={label}
            onChange={setLabel}
            maxLength={POSITIONING_LABEL_MAX_LENGTH}
            isInvalid={wasSent && label.trim() === ''}
            className="flex flex-col gap-1.5"
          >
            <Label>{m.positioning_label()}</Label>
            {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the panel was just opened: its field takes the focus, which closing gives back. */}
            <Input autoFocus className="max-md:h-11" />
            <FieldErrorMessage>{m.positioning_label_required()}</FieldErrorMessage>
          </TextField>
          <ErrorMessage>
            {relabel.isError ? m.auth_error() : refusalText(relabel.data)}
          </ErrorMessage>
        </GesturePanelBody>
        <GesturePanelFooter>
          <Button variant="outline" className="max-md:min-h-11" onPress={onClose}>
            {m.cancel()}
          </Button>
          <Button type="submit" className="max-md:min-h-11" isDisabled={relabel.isPending}>
            {m.positioning_relabel_validate()}
          </Button>
        </GesturePanelFooter>
      </Form>
    </GesturePanel>
  );
}
