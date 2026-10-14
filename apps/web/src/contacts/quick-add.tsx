import {
  ADDABLE_CONTACT_STATUSES,
  CONTACT_NAME_MAX_LENGTH,
  type AddableContactStatus,
} from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Form, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import {
  applySummaryChanges,
  SUMMARY_KEY,
  summaryQuery,
  type Summary,
  type SummaryContact,
} from '../summary.ts';
import { notifyGesture } from '../undo.tsx';
import { prospectingStageOf, STATUS_LABEL } from './status.ts';

/**
 * The quick add of a Contact (spec UX §6.8): a modal opened by `N` or “+ Add”. A name, and the
 * Status it is added in: the Pool by default, Prospecting at a Stage, or Ally. Nothing is kept from
 * one opening to the next.
 */
export function QuickAdd({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  useLocale();
  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{m.add_contact()}</DialogTitle>
      </DialogHeader>
      <QuickAddForm onAdded={() => onOpenChange(false)} />
    </Dialog>
  );
}

function QuickAddForm({ onAdded }: { onAdded: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const stageFieldId = useId();
  // The Stages of the Funnel come with the summary the shell reads, not read again for a modal;
  // without them, the API picks the first one.
  const stages = useQuery({ ...summaryQuery(api), refetchOnMount: false }).data?.stages ?? [];
  const funnel = stages.filter((stage) => !stage.archived);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<AddableContactStatus>('pool');
  // None chosen yet: the first Stage not archived, as the API would take it.
  const [chosenStageId, setChosenStageId] = useState<string>();
  const stageId = chosenStageId ?? funnel[0]?.id;
  const add = useMutation({
    mutationFn: async () => {
      const response = await api.contacts.$post({
        json: status === 'prospecting' && stageId ? { name, status, stageId } : { name, status },
      });
      // The Stage chosen left the Funnel meanwhile, on another device: the summary is behind.
      if (response.status === 400 && (await response.json()).error === 'unknown_stage') {
        return 'stage_gone' as const;
      }
      if (!response.ok) throw new Error('POST /api/contacts failed');
      return response.json();
    },
    onSuccess: async (answer) => {
      if (answer === 'stage_gone') {
        setChosenStageId(undefined);
        await queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
        return;
      }
      const { changes, undoToken } = answer;
      await applySummaryChanges(queryClient, changes);
      const [added] = changes.contacts;
      if (added) notifyGesture(addedMessage(added, stages), undoToken);
      onAdded();
    },
  });
  return (
    <Form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!add.isPending) add.mutate();
      }}
    >
      <TextField
        name="name"
        value={name}
        onChange={setName}
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the User just opened this modal to type a name: its field takes the focus, which closing gives back.
        autoFocus
        autoComplete="off"
        maxLength={CONTACT_NAME_MAX_LENGTH}
        validate={(candidate) => (candidate.trim() === '' ? m.contact_name_required() : null)}
        className="flex flex-col gap-1.5"
      >
        <Label>{m.contact_name()}</Label>
        <Input className="max-md:h-11" />
        <FieldErrorMessage />
      </TextField>
      <SegmentedControl
        value={status}
        onChange={(value) => {
          const chosen = ADDABLE_CONTACT_STATUSES.find((candidate) => candidate === value);
          if (chosen) setStatus(chosen);
        }}
      >
        <Label>{m.contact_status()}</Label>
        <SegmentedControlItems>
          {ADDABLE_CONTACT_STATUSES.map((candidate) => (
            <SegmentedControlItem key={candidate} value={candidate}>
              {STATUS_LABEL[candidate]()}
            </SegmentedControlItem>
          ))}
        </SegmentedControlItems>
      </SegmentedControl>
      {status === 'prospecting' && funnel.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={stageFieldId}>{m.contact_stage()}</Label>
          <select
            id={stageFieldId}
            value={stageId}
            onChange={(event) => setChosenStageId(event.target.value)}
            className="h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm"
          >
            {funnel.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <ErrorMessage>
        {add.isError ? m.auth_error() : add.data === 'stage_gone' && m.contact_stage_gone()}
      </ErrorMessage>
      <DialogFooter>
        <Button type="submit" className="max-md:min-h-11" isDisabled={add.isPending}>
          {m.add()}
        </Button>
      </DialogFooter>
    </Form>
  );
}

/** What the notification says, by the Status the Contact was added in (spec UX §10). */
function addedMessage(added: SummaryContact, stages: Summary['stages']): string {
  const { name } = added;
  switch (added.status) {
    case 'prospecting': {
      const stage = prospectingStageOf(added, stages);
      return stage
        ? m.contact_entered_funnel({ name, stage })
        : m.contact_entered_funnel_anywhere({ name });
    }
    case 'ally':
      return m.contact_entered_circle({ name });
    default:
      return m.contact_added_to_pool({ name });
  }
}
