import { CONTACT_NAME_MAX_LENGTH } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Form, TextField } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ErrorMessage, FieldErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { useLocale } from '../i18n.ts';
import { useApi } from '../session.ts';
import { applySummaryChanges } from '../summary.ts';
import { notifyGesture } from '../undo.tsx';

/**
 * The quick add of a Contact (spec UX §6.8): a modal opened by `N` or “+ Add”. Only the name is
 * asked for now, and the Contact joins the Pool. Nothing is kept from one opening to the next.
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
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: async () => {
      const response = await api.contacts.$post({ json: { name } });
      if (!response.ok) throw new Error('POST /api/contacts failed');
      return response.json();
    },
    onSuccess: async ({ changes, undoToken }) => {
      await applySummaryChanges(queryClient, changes);
      notifyGesture(
        m.contact_added_to_pool({ name: changes.contacts[0]?.name ?? name.trim() }),
        undoToken,
      );
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
      <ErrorMessage>{add.isError && m.auth_error()}</ErrorMessage>
      <DialogFooter>
        <Button type="submit" className="max-md:min-h-11" isDisabled={add.isPending}>
          {m.add()}
        </Button>
      </DialogFooter>
    </Form>
  );
}
