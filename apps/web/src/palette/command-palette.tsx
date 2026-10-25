import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  Autocomplete,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  TextField,
} from 'react-aria-components';

import { notify } from '../components/ui/toast.tsx';
import { Dialog, DialogTitle } from '../components/ui/dialog.tsx';
import { useAddContact } from '../contacts/add-contact-context.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import { PickContact } from '../contacts/pick-contact.tsx';
import { otherFunnelView, setFunnelView } from '../funnel/funnel-view.ts';
import { nextActionText } from '../funnel/next-action.tsx';
import { locales, useLocale, type Locale } from '../i18n.ts';
import { useIsOnline } from '../online.ts';
import { useApi } from '../session.ts';
import { useIsNarrow } from '../use-narrow.ts';
import { LANGUAGE_NAMES, THEME_LABELS, THEMES } from '../settings/preferences-settings.tsx';
import { useChangeSettings } from '../settings/use-settings.ts';
import { useSignOut } from '../shell/account.tsx';
import { experimentation, prospecting, settings } from '../shell/navigation.ts';
import {
  openBattleAt,
  organizationOf,
  summaryQuery,
  todayOf,
  type Summary,
  type SummaryContact,
} from '../summary.ts';
import { useTheme } from '../theme/theme-provider.tsx';
import {
  contactActionsOf,
  contactNeedingAction,
  contactsFound,
  labelMatches,
  needingActionOf,
  verbFirst,
  type ContactAction,
  type NeedsAction,
} from './palette-items.ts';

/** A choice of the palette: what it shows, and what choosing it does. */
type Item = {
  key: string;
  textValue: string;
  content: ReactNode;
  run: () => void;
  /** The Contact whose actions `→` or `Tab` show (spec UX §3.3). */
  contact?: SummaryContact;
};
type Section = { key: string; title: string; items: Item[] };

/** Before anything is typed, or on the actions of a Contact chosen first (spec UX §3.3). */
type Mode = { kind: 'search' } | { kind: 'actions'; contactId: string; typedBefore: string };

/** How many Contacts and Organizations a group shows at most: the rest comes by typing more. */
const MAX_FOUND = 8;

/**
 * The command palette (spec UX §3.3): a centred window, searched in memory over the summary. Before
 * anything is typed, the Contacts to handle and the Allies to check in with; while typing, groups of
 * Contacts, Organizations, Actions, Create, Go to, Preferences and more.
 */
export function CommandPalette({
  isOpen,
  onOpenChange,
  onShortcuts,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Opens the help of the shortcuts. */
  onShortcuts: () => void;
}) {
  const { data: summary } = useQuery(summaryQuery(useApi()));
  const [isPicking, setPicking] = useState(false);
  const navigate = useNavigate();
  return (
    <>
      <Dialog
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        className="top-[10vh] max-h-[80vh] translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 data-entering:zoom-in-100 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{m.palette_title()}</DialogTitle>
        {summary && (
          <PaletteContent
            summary={summary}
            close={() => onOpenChange(false)}
            onShortcuts={onShortcuts}
            onNoteInteraction={() => setPicking(true)}
          />
        )}
      </Dialog>
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
    </>
  );
}

/** The field and its choices, fresh at each opening. */
function PaletteContent({
  summary,
  close,
  onShortcuts,
  onNoteInteraction,
}: {
  summary: Summary;
  close: () => void;
  onShortcuts: () => void;
  onNoteInteraction: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'search' });
  const fieldRef = useRef<HTMLInputElement>(null);
  const commands = useCommands(summary, { close, onShortcuts, onNoteInteraction });
  const navigate = useNavigate();
  const locale = useLocale();
  const addContact = useAddContact();
  const isNarrow = useIsNarrow();
  const showActions = (contact: SummaryContact) => {
    setMode({ kind: 'actions', contactId: contact.id, typedBefore: typed });
    setTyped('');
  };

  const openAction = (contact: SummaryContact, action: ContactAction) => {
    close();
    if ('organizationId' in action) {
      void navigate({
        to: '/organizations/$organizationId',
        params: { organizationId: action.organizationId },
      });
      return;
    }
    void navigate({
      to: '/contacts/$contactId',
      params: { contactId: contact.id },
      search: action.record,
    });
  };
  const contactItem = (contact: SummaryContact, key: string, line?: string): Item => ({
    key,
    textValue: contact.name,
    content: <ContactLine contact={contact} summary={summary} line={line} />,
    // On a phone, without `→`, choosing a Contact shows its actions, “Open the record” first (spec UX §3.2).
    run: () =>
      isNarrow
        ? showActions(contact)
        : openAction(contact, { id: 'record', verb: m.palette_open_record, record: {} }),
    contact,
  });

  const chosen =
    mode.kind === 'actions' ? summary.contacts.find(({ id }) => id === mode.contactId) : undefined;
  let sections: Section[];
  if (chosen) {
    sections = [
      {
        key: 'actions',
        title: chosen.name,
        items: contactActionsOf(chosen, summary)
          .filter((action) => labelMatches(typed, action.verb()))
          .map((action) => ({
            key: `action:${action.id}`,
            textValue: action.verb(),
            content: action.verb(),
            run: () => openAction(chosen, action),
          })),
      },
    ];
  } else if (typed.trim() === '') {
    sections = [
      {
        key: 'needs-action',
        title: m.palette_needs_action(),
        items: needingActionOf(summary, todayOf(summary)).map((needing) =>
          contactItem(
            contactNeedingAction(needing),
            `needs-action:${contactNeedingAction(needing).id}`,
            needsActionLine(needing, summary, locale),
          ),
        ),
      },
    ];
  } else {
    const wanted = typed.trim();
    sections = [
      {
        key: 'contacts',
        title: m.contacts(),
        items: contactsFound(wanted, summary)
          .slice(0, MAX_FOUND)
          .map((contact) => contactItem(contact, `contact:${contact.id}`)),
      },
      {
        key: 'organizations',
        title: m.palette_organizations(),
        items: summary.organizations
          .filter(({ name }) => labelMatches(wanted, name))
          .toSorted((a, b) => a.name.localeCompare(b.name))
          .slice(0, MAX_FOUND)
          .map((organization) => ({
            key: `organization:${organization.id}`,
            textValue: organization.name,
            content: organization.name,
            run: () => {
              close();
              void navigate({
                to: '/organizations/$organizationId',
                params: { organizationId: organization.id },
              });
            },
          })),
      },
      {
        key: 'actions',
        title: m.palette_actions(),
        items: verbFirst(wanted, summary)
          .slice(0, MAX_FOUND)
          .map(({ contact, action }) => {
            const text = m.palette_action_on({ verb: action.verb(), name: contact.name });
            return {
              key: `verb:${contact.id}:${action.id}`,
              textValue: text,
              content: (
                <span>
                  {action.verb()} · <ContactName contact={contact} />
                </span>
              ),
              run: () => openAction(contact, action),
            };
          }),
      },
      ...commands.map((group) => ({
        ...group,
        items: group.items.filter(({ textValue }) => labelMatches(wanted, textValue)),
      })),
    ];
    if (sections.every(({ items }) => items.length === 0)) {
      // Without a result, the name typed may be a Contact to add (spec UX §3.3).
      sections = [
        {
          key: 'add',
          title: m.palette_create(),
          items: [
            {
              key: 'add-named',
              textValue: m.palette_add_named({ name: wanted }),
              content: m.palette_add_named({ name: wanted }),
              run: () => {
                close();
                addContact({ name: wanted, status: 'pool' });
              },
            },
          ],
        },
      ];
    }
  }
  sections = sections.filter(({ items }) => items.length > 0);
  const items = new Map(
    sections.flatMap((section) => section.items.map((item) => [item.key, item])),
  );

  /** The choice the keyboard is on, in the list the field controls (its focus stays in the field). */
  const focusedItem = (field: HTMLInputElement) => {
    const list = document.getElementById(field.getAttribute('aria-controls') ?? '');
    const option = list?.querySelector<HTMLElement>('[role="option"][data-focused]');
    const key = option?.dataset['key'];
    return key === undefined ? undefined : items.get(key);
  };
  const onKeyDown = (event: KeyboardEvent, field: HTMLInputElement) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if ((event.key === 'ArrowRight' || event.key === 'Tab') && mode.kind === 'search') {
      const contact = focusedItem(field)?.contact;
      // `→` keeps moving the caret, unless it is at the end of what is typed.
      if (!contact || (event.key === 'ArrowRight' && field.selectionStart !== typed.length)) return;
      event.preventDefault();
      // Before the window keeps `Tab` within it: the focus stays in the field.
      event.stopPropagation();
      showActions(contact);
    }
    if (event.key === 'Backspace' && typed === '' && mode.kind === 'actions') {
      event.preventDefault();
      setTyped(mode.typedBefore);
      setMode({ kind: 'search' });
    }
  };
  useFieldKeys(fieldRef, onKeyDown);

  return (
    <Autocomplete inputValue={typed} onInputChange={setTyped}>
      <TextField
        aria-label={chosen ? m.palette_field_actions({ name: chosen.name }) : m.palette_field()}
        className="flex items-center gap-2 border-b px-3 pr-10"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- the palette was just opened to type in.
        autoFocus
      >
        <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        {chosen && (
          <span className="shrink-0 rounded-control bg-surface px-1.5 py-0.5 text-xs">
            <ContactName contact={chosen} />
          </span>
        )}
        <Input
          type="search"
          placeholder={chosen ? m.palette_field_actions({ name: chosen.name }) : m.palette_field()}
          ref={fieldRef}
          className="h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
      </TextField>
      <ListBox
        aria-label={m.palette_title()}
        onAction={(key) => items.get(String(key))?.run()}
        renderEmptyState={() => (
          <p className="px-3 py-4 text-muted-foreground">
            {typed.trim() === '' && mode.kind === 'search'
              ? m.palette_nothing_needs_action()
              : m.palette_no_result()}
          </p>
        )}
        className="overflow-y-auto overscroll-contain p-1 outline-none"
      >
        {sections.map((section) => (
          <ListBoxSection key={section.key} id={section.key} className="pb-1">
            <Header className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
              {section.title}
            </Header>
            {section.items.map((item) => (
              <ListBoxItem
                key={item.key}
                id={item.key}
                textValue={item.textValue}
                className="cursor-default rounded-control px-2 py-1.5 outline-none data-focused:bg-surface max-md:py-3"
              >
                {item.content}
              </ListBoxItem>
            ))}
          </ListBoxSection>
        ))}
      </ListBox>
      <p className="border-t px-3 py-1.5 text-xs text-muted-foreground max-md:hidden">
        {mode.kind === 'actions' ? m.palette_back_hint() : m.palette_actions_hint()}
      </p>
    </Autocomplete>
  );
}

/**
 * The keys of the field, heard before anything else in the window: the window that holds the field
 * takes `Tab` first, to keep the focus within it.
 */
function useFieldKeys(
  fieldRef: RefObject<HTMLInputElement | null>,
  onKeyDown: (event: KeyboardEvent, field: HTMLInputElement) => void,
) {
  const latest = useRef(onKeyDown);
  useEffect(() => {
    latest.current = onKeyDown;
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const field = fieldRef.current;
      if (field && event.target === field) latest.current(event, field);
    };
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, [fieldRef]);
}

/** A Contact as the palette lists it: its name, starred for an Ally, its Organization and Stage. */
function ContactLine({
  contact,
  summary,
  line,
}: {
  contact: SummaryContact;
  summary: Summary;
  line: string | undefined;
}) {
  const organization = organizationOf(contact, summary);
  const stage =
    contact.status === 'prospecting'
      ? summary.stages.find(({ id }) => id === contact.stageId)
      : undefined;
  const details = [organization?.name, stage?.name].filter(Boolean).join(' · ');
  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">
        <ContactName contact={contact} />
      </span>
      {(details || line) && (
        <span className="truncate text-xs text-muted-foreground">
          {[details, line].filter(Boolean).join(' · ')}
        </span>
      )}
    </span>
  );
}

/** What a Contact to handle waits for, as Today says it (spec UX §5.1). */
function needsActionLine({ row }: NeedsAction, summary: Summary, locale: Locale): string {
  if (row.kind === 'ally') {
    return m.today_ally_rhythm_past({
      late: row.daysLate,
      days: row.signal.daysSinceContact,
    });
  }
  return nextActionText(row.card, summary, todayOf(summary), locale);
}

/** The choices that are not about a Contact: Create, Go to, Preferences and more (spec UX §3.3). */
function useCommands(
  summary: Summary,
  {
    close,
    onShortcuts,
    onNoteInteraction,
  }: { close: () => void; onShortcuts: () => void; onNoteInteraction: () => void },
): Section[] {
  const navigate = useNavigate();
  const addContact = useAddContact();
  const theme = useTheme();
  const locale = useLocale();
  const { change } = useChangeSettings();
  const signOut = useSignOut();
  // The commands that save wait for the connection (ADR 0004): offline, they are not offered.
  const isOnline = useIsOnline();
  const command = (key: string, text: string, run: () => void): Item => ({
    key: `command:${key}`,
    textValue: text,
    content: text,
    run: () => {
      close();
      run();
    },
  });
  const stages = summary.stages.filter(({ archived }) => !archived);
  const stageToBattle = stages.find(({ id }) => openBattleAt(summary, id) === undefined);
  return [
    {
      key: 'create',
      title: m.palette_create(),
      items: [
        command('add-contact', m.add_contact(), () => addContact()),
        command('note-interaction', m.floating_add_note_interaction(), onNoteInteraction),
        command('new-positioning', m.palette_create_positioning(), () => {
          const [stage] = stages;
          void navigate(
            stage
              ? { to: '/positionings', search: { stage: stage.id, panel: 'new' } }
              : { to: '/positionings' },
          );
        }),
        command('open-battle', m.battles_open(), () => {
          void navigate(
            stageToBattle
              ? { to: '/battles', search: { stage: stageToBattle.id, panel: 'open' } }
              : { to: '/battles' },
          );
        }),
      ],
    },
    {
      key: 'go-to',
      title: m.palette_go_to(),
      items: [...prospecting, ...experimentation, settings].map((entry) =>
        command(`go-to:${entry.to}`, entry.label(), () => void navigate({ to: entry.to })),
      ),
    },
    {
      key: 'more',
      title: m.palette_more(),
      items: [
        command('history', m.battles_view_history(), () => {
          void navigate({ to: '/battles', search: { view: 'history' } });
        }),
        command('funnel-view', m.palette_funnel_view(), () => {
          setFunnelView(otherFunnelView());
          void navigate({ to: '/funnel' });
        }),
        ...THEMES.filter((preference) => preference !== theme.preference).map((preference) =>
          command(
            `theme:${preference}`,
            m.palette_theme({ theme: THEME_LABELS[preference]() }),
            () => theme.setPreference(preference),
          ),
        ),
        ...locales
          .filter((candidate) => isOnline && candidate !== locale)
          .map((candidate) =>
            command(
              `language:${candidate}`,
              m.palette_language({ language: LANGUAGE_NAMES[candidate] }),
              () => change({ locale: candidate }, m.language),
            ),
          ),
        command('shortcuts', m.shortcuts(), onShortcuts),
        ...(isOnline
          ? [
              command('sign-out', m.sign_out(), () =>
                signOut.mutate(undefined, {
                  onError: () => notify({ message: m.auth_error(), isError: true }),
                }),
              ),
            ]
          : []),
      ],
    },
  ];
}
