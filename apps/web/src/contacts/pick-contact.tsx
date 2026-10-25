import { contactsMatching } from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useState } from 'react';

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '../components/ui/combobox.tsx';
import { Dialog, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { Label } from '../components/ui/label.tsx';
import { organizationOf, type Summary, type SummaryContact } from '../summary.ts';

/** The choice that adds the name typed, when no Contact matches it. */
const QUICK_ADD_ID = 'quick-add';
type Choice = SummaryContact | { id: typeof QUICK_ADD_ID; name: string };

/**
 * A window to choose a Contact before a gesture, in a list filtered as it is typed (Add to Circle…,
 * spec UX §5.11; Note an Interaction… of the + button, §3.2). With `quickAdd`, a name that matches
 * no Contact offers to add it.
 */
export function PickContact({
  summary,
  title,
  contacts,
  isOpen,
  onOpenChange,
  onPick,
  quickAdd,
}: {
  summary: Summary;
  title: string;
  /** The Contacts to choose from. */
  contacts: SummaryContact[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPick: (contact: SummaryContact) => void;
  quickAdd?: { label: (name: string) => string; onAdd: (name: string) => void };
}) {
  const [typed, setTyped] = useState('');
  const matching = contactsMatching(typed, contacts, summary.organizations);
  const name = typed.trim();
  // Without a match, the one choice is the quick add of the name typed.
  const choices: Choice[] =
    matching.length > 0 || name === '' || quickAdd === undefined
      ? matching
      : [{ id: QUICK_ADD_ID, name }];
  const close = () => {
    setTyped('');
    onOpenChange(false);
  };
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      className="sm:max-w-md"
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <Combobox
        inputValue={typed}
        onInputChange={setTyped}
        onSelectionChange={(key) => {
          if (key === QUICK_ADD_ID) {
            close();
            quickAdd?.onAdd(name);
            return;
          }
          const chosen = contacts.find(({ id }) => id === key);
          if (!chosen) return;
          close();
          onPick(chosen);
        }}
        items={choices}
        allowsEmptyCollection
        menuTrigger="focus"
        className="flex flex-col gap-1.5"
      >
        <Label>{m.pick_contact()}</Label>
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- the window was just opened to choose a Contact: its field takes the focus. */}
        <ComboboxInput autoFocus showTrigger={contacts.length > 0} className="max-md:h-11" />
        <ComboboxContent>
          <ComboboxList<Choice>
            renderEmptyState={() => (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                {m.pick_contact_no_match()}
              </p>
            )}
          >
            {(contact) => {
              if (!('status' in contact)) {
                return (
                  <ComboboxItem id={QUICK_ADD_ID} textValue={contact.name}>
                    {quickAdd?.label(contact.name)}
                  </ComboboxItem>
                );
              }
              const organization = organizationOf(contact, summary);
              return (
                <ComboboxItem id={contact.id} textValue={contact.name}>
                  <span>
                    {contact.name}
                    {organization && (
                      <span className="text-muted-foreground"> · {organization.name}</span>
                    )}
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Dialog>
  );
}
