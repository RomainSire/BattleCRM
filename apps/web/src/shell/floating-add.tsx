import { m } from '@battlecrm/i18n';
import { Button, MenuItem } from '@battlecrm/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Menu, MenuTrigger, Popover } from 'react-aria-components';

import { PickContact } from '../contacts/pick-contact.tsx';
import { useApi } from '../session.ts';
import { summaryQuery } from '../summary.ts';

/**
 * The floating + button of the narrow width, above the tabs (spec UX §3.2): Add a Contact, or Note
 * an Interaction… on a Contact chosen first, which opens on its record as a page; on an Ally, that
 * gesture is Check in… (spec UX §6.4).
 */
export function FloatingAdd({ onAdd }: { onAdd: () => void }) {
  const api = useApi();
  const navigate = useNavigate();
  const { data: summary } = useQuery(summaryQuery(api));
  const [isPicking, setPicking] = useState(false);
  return (
    <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 md:hidden">
      <MenuTrigger>
        <Button
          variant="outline"
          size="icon"
          aria-label={m.floating_add_label()}
          className="size-14 rounded-full border-accent-text bg-background text-accent-text shadow-md"
        >
          <Plus className="size-6" />
        </Button>
        <Popover
          placement="top end"
          className="min-w-56 rounded-card bg-background p-1 text-sm text-foreground shadow-lg ring-1 ring-border outline-none"
        >
          <Menu
            onAction={(key) => (key === 'add' ? onAdd() : setPicking(true))}
            className="outline-none"
          >
            <MenuItem id="add">{m.add_contact()}</MenuItem>
            <MenuItem id="note">{m.floating_add_note_interaction()}</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {summary && (
        <PickContact
          summary={summary}
          title={m.floating_add_note_interaction()}
          contacts={summary.contacts}
          isOpen={isPicking}
          onOpenChange={setPicking}
          onPick={({ id, status }) =>
            void navigate({
              to: '/contacts/$contactId',
              params: { contactId: id },
              search: { interaction: status === 'ally' ? 'check-in' : 'note' },
            })
          }
        />
      )}
    </div>
  );
}
