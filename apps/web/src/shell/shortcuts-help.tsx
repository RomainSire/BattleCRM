import { m } from '@battlecrm/i18n';
import { Dialog, DialogHeader, DialogTitle } from '@battlecrm/ui';
import { Fragment, useId, type ReactNode } from 'react';

import { useSettings } from '../settings/use-settings.ts';
import { GO_TO_KEYS } from './go-to.tsx';
import { experimentation, prospecting, settings } from './navigation.ts';

/** Keys pressed together or in turn, as the help writes them. */
type Keys = string[][];

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded-sm border bg-surface px-1.5 font-sans text-xs">{children}</kbd>
);

/** `[['Ctrl', 'K'], ['/']]`: Ctrl K or /. `inTurn`, each combination comes after the one before. */
function KeysText({ keys, inTurn = false }: { keys: Keys; inTurn?: boolean | undefined }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {keys.map((combo, index) => (
        <Fragment key={combo.join('+')}>
          {index > 0 && (
            <span className="text-xs text-muted-foreground">
              {inTurn ? m.shortcuts_then() : m.shortcuts_or()}
            </span>
          )}
          {combo.map((key) => (
            <Key key={key}>{key}</Key>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

type Row = { keys: Keys; inTurn?: boolean; label: string };

function Group({ title, rows }: { title: string; rows: Row[] }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="text-xs font-semibold text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1">
        {rows.map(({ keys, inTurn, label }) => (
          <Fragment key={label}>
            <dt>
              <KeysText keys={keys} inTurn={inTurn} />
            </dt>
            <dd>{label}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

const entries = [...prospecting, ...experimentation, settings];

/** The help of the shortcuts (spec UX §3.3), opened by `?` or “Shortcuts” in the menu. */
export function ShortcutsHelp({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const { singleKeyShortcuts } = useSettings();
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>{m.shortcuts_title()}</DialogTitle>
      </DialogHeader>
      {!singleKeyShortcuts && (
        <p className="text-muted-foreground">{m.shortcuts_single_key_off()}</p>
      )}
      <Group
        title={m.shortcuts_everywhere()}
        rows={[
          { keys: [['Ctrl', 'K'], ['/']], label: m.shortcuts_palette() },
          { keys: [['N']], label: m.add_contact() },
          { keys: [['?']], label: m.shortcuts_help() },
          { keys: [[m.key_escape()]], label: m.shortcuts_close() },
        ]}
      />
      <Group
        title={m.palette_go_to()}
        rows={Object.entries(GO_TO_KEYS).map(([letter, to]) => ({
          keys: [['G'], [letter.toUpperCase()]],
          inTurn: true,
          label: entries.find((entry) => entry.to === to)?.label() ?? to,
        }))}
      />
      <Group
        title={m.shortcuts_record()}
        rows={[
          { keys: [['F']], label: m.verb_follow_up() },
          { keys: [['U']], label: m.verb_use_positioning() },
          { keys: [['I']], label: m.verb_note_interaction() },
          { keys: [['P']], label: `${m.verb_schedule_follow_up()} / ${m.verb_edit_follow_up()}` },
          { keys: [['S']], label: m.verb_change_status() },
        ]}
      />
      <p className="-mt-2 text-xs text-muted-foreground">{m.shortcuts_record_ally()}</p>
      <Group
        title={m.shortcuts_funnel()}
        rows={[
          { keys: [['V']], label: m.shortcuts_funnel_view() },
          { keys: [['E']], label: m.verb_change_stage() },
          { keys: [['S']], label: m.verb_change_status() },
          { keys: [['←', '↑', '→', '↓']], label: m.shortcuts_funnel_move() },
        ]}
      />
      <Group
        title={m.shortcuts_panels()}
        rows={[
          { keys: [[m.key_enter()]], label: m.shortcuts_validate() },
          { keys: [['1'], ['2'], ['3']], label: m.shortcuts_trial() },
        ]}
      />
      <Group
        title={m.shortcuts_quick_add()}
        rows={[
          { keys: [[m.key_enter()]], label: m.shortcuts_quick_add_add() },
          { keys: [['Ctrl', m.key_enter()]], label: m.shortcuts_quick_add_send() },
        ]}
      />
    </Dialog>
  );
}
