import { m } from '@battlecrm/i18n';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '../components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { OfflineNote } from '../components/ui/offline-note.tsx';
import { useSendGesture } from '../gesture.ts';
import { useApi } from '../session.ts';
import type { SummaryContact } from '../summary.ts';
import { contactRecordQuery } from './contact-record-query.ts';

/**
 * Delete the Contact… (spec UX §6.13, ADR 0006): irreversible, so confirmed first and never undone.
 * It offers to archive instead, to only stop prospecting. Deleted, the Contact leaves the summary.
 */
export function DeleteContactDialog({
  contact,
  onClose,
  onArchive,
  onDeleted,
}: {
  contact: Pick<SummaryContact, 'id' | 'name' | 'status'>;
  onClose: () => void;
  onArchive: () => void;
  onDeleted: () => void;
}) {
  const api = useApi();
  const sendGesture = useSendGesture();
  // Its Trials, as the record reads them: what stays in the Battles.
  const { data: record } = useQuery(contactRecordQuery(api, contact.id));
  const trialCount = record?.trialCount ?? 0;
  const remove = useMutation({
    mutationFn: () =>
      sendGesture(api.contacts[':id'].delete.$post({ param: { id: contact.id } }), () =>
        m.contact_deleted_toast({ name: contact.name }),
      ),
    onSuccess: (refused) => {
      if (!refused) onDeleted();
    },
  });
  const error = remove.isError ? m.auth_error() : remove.data !== undefined && m.contact_unknown();
  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      className="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>{m.contact_delete_title({ name: contact.name })}</DialogTitle>
      </DialogHeader>
      <DialogDescription>
        {m.contact_delete_body()}
        {trialCount > 0 && <> {m.contact_delete_trials({ count: trialCount })}</>}
      </DialogDescription>
      {contact.status !== 'archived' && (
        <p className="text-muted-foreground">{m.contact_delete_archive_hint()}</p>
      )}
      <ErrorMessage>{error}</ErrorMessage>
      <OfflineNote />
      <DialogFooter>
        <DialogClose>{m.cancel()}</DialogClose>
        {contact.status !== 'archived' && (
          <Button variant="outline" onPress={onArchive}>
            {m.contact_delete_archive()}
          </Button>
        )}
        <Button isDisabled={remove.isPending} saves onPress={() => remove.mutate()}>
          {m.contact_delete_confirm()}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
