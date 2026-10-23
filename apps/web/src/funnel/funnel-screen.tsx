import { TARGETS, type ContactStatus } from '@battlecrm/contract';
import {
  byUrgency,
  isFollowUpDueIn,
  funnelOf,
  normalizeName,
  startedTrials,
  targetOf,
  type AgendaRow,
  type ContactAgenda,
  type Target,
} from '@battlecrm/domain';
import { m } from '@battlecrm/i18n';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { cn } from 'cn';
import { GripVertical } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { flushSync } from 'react-dom';
import {
  DropZone,
  GridList,
  GridListHeader,
  GridListItem,
  GridListSection,
  SearchField,
  useDragAndDrop,
  type DropItem,
  type Key,
} from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { MenuItem, MoreActions } from '../components/ui/menu.tsx';
import {
  SegmentedControl,
  SegmentedControlItem,
  SegmentedControlItems,
} from '../components/ui/segmented-control.tsx';
import { useLocale } from '../i18n.ts';
import { Screen } from '../screens/screen.tsx';
import { useApi } from '../session.ts';
import { useSettings, useSingleKeyShortcuts } from '../settings/use-settings.ts';
import { isModalOpen } from '../shortcuts.ts';
import { Kbd } from '../shell/kbd.tsx';
import {
  openBattleAt,
  organizationOf,
  positioningsOf,
  summaryQuery,
  todayOf,
  trialCountsOf,
  trialOf,
  type Summary,
} from '../summary.ts';
import { useIsNarrow } from '../use-narrow.ts';
import { useAddContact } from '../contacts/add-contact-context.ts';
import { ContactName } from '../contacts/contact-name.tsx';
import {
  ContactPanel,
  RecordGesturePanels,
  useRecordGestures,
} from '../contacts/contact-record.tsx';
import { targetText } from '../contacts/organization-field.tsx';
import { STATUS_VERB } from '../contacts/status.ts';
import { agendaOf } from './agenda.ts';
import { FunnelList } from './funnel-list.tsx';
import { FunnelTable } from './funnel-table.tsx';
import { isFunnelView, useFunnelView, type FunnelView } from './funnel-view.ts';
import {
  CardActions,
  nextActionText,
  type Card,
  type FunnelGestureSearch,
  type OpenGesture,
} from './next-action.tsx';

/** What a card carries while it is dragged: the id of its Contact. */
const CONTACT_DRAG_TYPE = 'application/x-battlecrm-contact';

/** The rows of the board, computed: nothing is dropped in a row, only in a Stage (spec UX §5.2). */
const ROWS: { id: AgendaRow; label: () => string }[] = [
  { id: 'needs-action', label: m.funnel_lane_needs_action },
  { id: 'waiting', label: m.funnel_lane_waiting },
  { id: 'no-next-step', label: m.funnel_lane_no_next_step },
];

/** The Statuses a card is dropped on while dragged, each opening its change of Status (spec UX §5.2). */
const STATUS_ZONES: { status: Exclude<ContactStatus, 'prospecting'>; label: () => string }[] = [
  { status: 'pool', label: m.status_pool },
  { status: 'ally', label: m.circle },
  { status: 'archived', label: m.status_archived },
];

// ——— Filters (spec UX §5.2) ———

type Signal = 'overdue' | 'elapsed' | 'no-next-step';
type Filters = {
  text: string;
  target: Target | '';
  /** Any Trial in a Battle, or the Trials of one Positioning. */
  battle: 'any' | (string & {}) | '';
  organizationId: string;
  signal: Signal | '';
};
const NO_FILTERS: Filters = { text: '', target: '', battle: '', organizationId: '', signal: '' };

const SIGNALS: { id: Signal; label: () => string }[] = [
  { id: 'overdue', label: m.funnel_signal_overdue },
  { id: 'elapsed', label: m.funnel_signal_elapsed },
  { id: 'no-next-step', label: m.funnel_signal_no_next_step },
];

function hasSignal(agenda: ContactAgenda, signal: Signal) {
  if (signal === 'no-next-step') return agenda.row === 'no-next-step';
  if (agenda.row !== 'needs-action') return false;
  return agenda.reason === (signal === 'overdue' ? 'follow-up-overdue' : 'window-elapsed');
}

function matches({ contact, agenda }: Card, filters: Filters, summary: Summary) {
  const organization = organizationOf(contact, summary);
  if (filters.text !== '') {
    const wanted = normalizeName(filters.text);
    const names = [contact.name, organization?.name];
    if (!names.some((name) => name !== undefined && normalizeName(name).includes(wanted))) {
      return false;
    }
  }
  if (filters.target !== '' && targetOf(organization) !== filters.target) return false;
  if (filters.organizationId !== '' && contact.organizationId !== filters.organizationId) {
    return false;
  }
  const trial = trialOf(contact);
  if (filters.battle === 'any' && trial === null) return false;
  if (
    filters.battle !== '' &&
    filters.battle !== 'any' &&
    trial?.positioningId !== filters.battle
  ) {
    return false;
  }
  return filters.signal === '' || hasSignal(agenda, filters.signal);
}

const selectClass =
  'h-8 w-full rounded-control border border-input bg-background px-2 text-base focus-ring max-md:h-11 md:text-sm';

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        <option value="">{m.funnel_filter_all()}</option>
        {children}
      </select>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  summary,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  summary: Summary;
}) {
  const set = (change: Partial<Filters>) => onChange({ ...filters, ...change });
  const prospecting = new Set(
    summary.contacts.filter(({ status }) => status === 'prospecting').map((c) => c.organizationId),
  );
  const organizations = summary.organizations
    .filter(({ id }) => prospecting.has(id))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  // The Positionings of the open Battles: a Trial of one of them.
  const inBattles = positioningsOf(summary).filter(({ id }) =>
    summary.battles.some(
      (battle) => battle.open && (battle.championId === id || battle.challengerId === id),
    ),
  );
  return (
    <search aria-label={m.funnel_filters()} className="flex flex-wrap items-end gap-3">
      <SearchField
        aria-label={m.funnel_filter_search()}
        value={filters.text}
        onChange={(text) => set({ text })}
        className="flex min-w-48 flex-col gap-1"
      >
        <Label>{m.funnel_filter_search()}</Label>
        <Input />
      </SearchField>
      <FilterSelect
        label={m.funnel_filter_target()}
        value={filters.target}
        onChange={(value) => set({ target: TARGETS.find((target) => target === value) ?? '' })}
      >
        {TARGETS.map((target) => (
          <option key={target} value={target}>
            {targetText(target)}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label={m.funnel_filter_battle()}
        value={filters.battle}
        onChange={(battle) => set({ battle })}
      >
        <option value="any">{m.funnel_filter_in_battle()}</option>
        {inBattles.map(({ id, label }) => (
          <option key={id} value={id}>
            {m.funnel_filter_trial_of({ label })}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label={m.funnel_filter_organization()}
        value={filters.organizationId}
        onChange={(organizationId) => set({ organizationId })}
      >
        {organizations.map(({ id, name }) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label={m.funnel_filter_signal()}
        value={filters.signal}
        onChange={(value) => set({ signal: SIGNALS.find(({ id }) => id === value)?.id ?? '' })}
      >
        {SIGNALS.map(({ id, label }) => (
          <option key={id} value={id}>
            {label()}
          </option>
        ))}
      </FilterSelect>
    </search>
  );
}

// ——— Cards (spec UX §5.2) ———

/** The menu `⋯` of a card (spec UX §5.2). */
const CARD_MENU: { id: string; label: () => string; search: FunnelGestureSearch }[] = [
  { id: 'stage', label: m.verb_change_stage, search: { stageTo: 'choose' } },
  { id: 'pool', label: STATUS_VERB.pool, search: { statusTo: 'pool' } },
  { id: 'ally', label: STATUS_VERB.ally, search: { statusTo: 'ally' } },
  { id: 'archived', label: STATUS_VERB.archived, search: { statusTo: 'archived' } },
  { id: 'status', label: m.verb_change_status, search: { statusTo: 'choose' } },
  { id: 'record', label: m.funnel_open_record, search: { panel: 'record' } },
];

function ContactCard({
  card,
  summary,
  today,
  onOpen,
}: {
  card: Card;
  summary: Summary;
  today: string;
  onOpen: OpenGesture;
}) {
  const locale = useLocale();
  const { contact, agenda } = card;
  const organization = organizationOf(contact, summary);
  const open = (search: FunnelGestureSearch) => onOpen(contact.id, search);
  return (
    <GridListItem
      id={contact.id}
      textValue={contact.name}
      className={cn(
        'flex flex-col gap-1.5 rounded-card border bg-background p-2.5 outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent-text focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-dragging:opacity-50',
      )}
    >
      <div className="flex items-start gap-1">
        <Button
          slot="drag"
          variant="ghost"
          size="icon-xs"
          aria-label={m.funnel_drag({ name: contact.name })}
          className="mt-0.5 cursor-grab text-muted-foreground"
        >
          <GripVertical />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">
            <ContactName contact={contact} />
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {organization?.name ?? m.no_organization()} · {targetText(targetOf(organization))}
          </span>
        </div>
        <MoreActions
          className="size-6"
          label={m.funnel_card_actions({ name: contact.name })}
          onAction={(key: Key) => {
            const item = CARD_MENU.find(({ id }) => id === key);
            if (item) open(item.search);
          }}
        >
          {CARD_MENU.map(({ id, label }) => (
            <MenuItem key={id} id={id}>
              {label()}
            </MenuItem>
          ))}
        </MoreActions>
      </div>
      <p
        className={cn(
          'text-xs',
          isFollowUpDueIn(agenda) ? 'font-medium text-overdue' : 'text-neutral-text',
        )}
      >
        {nextActionText(card, summary, today, locale)}
      </p>
      <CardActions card={card} summary={summary} open={open} />
    </GridListItem>
  );
}

// ——— Columns ———

/** The head of a column: name, Aim, count, open Battle; its menu leads to Settings (spec UX §5.2). */
function StageHeader({
  stage,
  count,
  summary,
  headingId,
}: {
  stage: Summary['stages'][number];
  count: number;
  summary: Summary;
  headingId: string;
}) {
  const navigate = useNavigate();
  const battle = openBattleAt(summary, stage.id);
  const labelOf = (id: string) => positioningsOf(summary).find((p) => p.id === id)?.label ?? '';
  const counts = battle && trialCountsOf(battle);
  const battleTexts = battle &&
    counts && {
      champion: labelOf(battle.championId),
      challenger: labelOf(battle.challengerId),
      championTrials: startedTrials(counts.champion),
      challengerTrials: startedTrials(counts.challenger),
      horizon: battle.horizon,
    };
  return (
    <div className="flex flex-col gap-0.5 rounded-card border bg-surface p-2.5">
      <div className="flex items-start justify-between gap-2">
        <h2 id={headingId} className="font-semibold">
          {stage.name}
        </h2>
        <MoreActions
          className="size-6"
          label={m.funnel_stage_actions({ stage: stage.name })}
          onAction={() => void navigate({ to: '/settings', hash: 'funnel' })}
        >
          <MenuItem id="rename">{m.funnel_rename_stage()}</MenuItem>
          <MenuItem id="manage">{m.funnel_manage_stages()}</MenuItem>
        </MoreActions>
      </div>
      {stage.aim && <p className="text-xs text-muted-foreground">{stage.aim}</p>}
      <p className="text-xs text-muted-foreground tabular-nums">
        {m.funnel_stage_contacts({ count })}
      </p>
      {battleTexts ? (
        <p className="text-xs text-accent-text tabular-nums">
          <span aria-hidden="true">{m.funnel_battle(battleTexts)}</span>
          <span className="sr-only">{m.funnel_battle_label(battleTexts)}</span>
        </p>
      ) : (
        <p className="text-xs text-neutral-text">{m.funnel_no_battle()}</p>
      )}
    </div>
  );
}

/** Where a drag stands: the card dragged, from its Stage. */
type Dragged = { contactId: string; stageId: string } | null;

/**
 * A column: a GridList of its cards in the three rows, aligned with the other columns (subgrid). A
 * card dropped on it changes Stage through the window of consequences (spec UX §6.6), with the mouse
 * or the keyboard, announced by React Aria (ST-61, ST-67).
 */
function StageColumn({
  stage,
  cards,
  summary,
  today,
  dragged,
  column,
  onDrag,
  onDropToStage,
  onOpen,
}: {
  stage: Summary['stages'][number];
  cards: Card[];
  summary: Summary;
  today: string;
  dragged: Dragged;
  column: number;
  onDrag: (dragged: Dragged) => void;
  onDropToStage: (contactId: string, stageId: string) => void;
  onOpen: OpenGesture;
}) {
  const headingId = `funnel-stage-${stage.id}`;
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) =>
      [...keys].map((key) => ({
        [CONTACT_DRAG_TYPE]: String(key),
        'text/plain': cards.find(({ contact }) => contact.id === key)?.contact.name ?? '',
      })),
    acceptedDragTypes: [CONTACT_DRAG_TYPE],
    // Dropped anywhere in the column, never between two cards; not where it comes from.
    getDropOperation: (target) =>
      target.type === 'root' && dragged?.stageId !== stage.id ? 'move' : 'cancel',
    onRootDrop: async ({ items }) => {
      const contactId = await contactIdOf(items);
      if (contactId) onDropToStage(contactId, stage.id);
    },
    onDragStart: ({ keys }) => {
      const [key] = keys;
      if (key !== undefined) onDrag({ contactId: String(key), stageId: stage.id });
    },
    onDragEnd: () => onDrag(null),
  });
  return (
    <>
      <div style={{ gridColumn: column, gridRow: 1 }}>
        <StageHeader stage={stage} count={cards.length} summary={summary} headingId={headingId} />
      </div>
      <GridList
        aria-labelledby={headingId}
        data-stage={stage.id}
        dragAndDropHooks={dragAndDropHooks}
        keyboardNavigationBehavior="tab"
        disallowTypeAhead
        style={{ gridColumn: column, gridRow: `2 / span ${ROWS.length}` }}
        className="grid grid-rows-subgrid gap-y-2 rounded-card outline-none data-drop-target:bg-accent/10 data-drop-target:ring-2 data-drop-target:ring-accent-text"
      >
        {ROWS.map((row) => {
          const inRow = cards.filter(({ agenda }) => agenda.row === row.id);
          return (
            <GridListSection
              key={row.id}
              id={row.id}
              aria-label={row.label()}
              className={cn(
                'flex min-h-12 flex-col gap-2 rounded-card p-1.5',
                // Needs action stands out, when it holds a card (spec UX §5.2).
                row.id === 'needs-action' && inRow.length > 0 ? 'bg-overdue/10' : 'bg-surface/60',
              )}
            >
              <GridListHeader className="sr-only">{row.label()}</GridListHeader>
              {inRow.map((card) => (
                <ContactCard
                  key={card.contact.id}
                  card={card}
                  summary={summary}
                  today={today}
                  onOpen={onOpen}
                />
              ))}
            </GridListSection>
          );
        })}
      </GridList>
    </>
  );
}

/** The Contact a drop carries. */
async function contactIdOf(items: DropItem[]): Promise<string | undefined> {
  for (const item of items) {
    if (item.kind === 'text' && item.types.has(CONTACT_DRAG_TYPE)) {
      return item.getText(CONTACT_DRAG_TYPE);
    }
  }
  return undefined;
}

/** While a card is dragged, the Statuses it may be dropped on (spec UX §5.2). */
function StatusZones({ onDropToStatus }: { onDropToStatus: OpenGesture }) {
  return (
    <fieldset className="fixed inset-x-0 bottom-6 z-30 flex justify-center gap-3 px-4">
      <legend className="sr-only">{m.funnel_status_zones()}</legend>
      {STATUS_ZONES.map(({ status, label }) => (
        <DropZone
          key={status}
          aria-label={STATUS_VERB[status]()}
          getDropOperation={(types) => (types.has(CONTACT_DRAG_TYPE) ? 'move' : 'cancel')}
          onDrop={async ({ items }) => {
            const contactId = await contactIdOf(items);
            if (contactId) onDropToStatus(contactId, { statusTo: status });
          }}
          className="min-w-28 rounded-card border-2 border-dashed border-input bg-background px-6 py-4 text-center font-semibold shadow-lg data-drop-target:border-accent-text data-drop-target:bg-surface data-focus-visible:ring-2 data-focus-visible:ring-accent-text"
        >
          {label()}
        </DropZone>
      ))}
    </fieldset>
  );
}

/** The card next to a card, in the column on that side: the one closest in height, past empty columns. */
function cardBeside(row: HTMLElement, step: -1 | 1): HTMLElement | undefined {
  const grids = [...document.querySelectorAll<HTMLElement>('[data-funnel-board] [role="grid"]')];
  const top = row.getBoundingClientRect().top;
  for (let index = grids.indexOf(row.closest('[role="grid"]') ?? row) + step; ; index += step) {
    const grid = grids[index];
    if (!grid) return undefined;
    const rows = [...grid.querySelectorAll<HTMLElement>('[role="row"][data-key]')];
    const closest = rows.toSorted(
      (a, b) =>
        Math.abs(a.getBoundingClientRect().top - top) -
        Math.abs(b.getBoundingClientRect().top - top),
    )[0];
    if (closest) return closest;
  }
}

/**
 * The kanban (spec UX §5.2): a column per Stage of the Funnel, the open Battle in its head; the
 * Contacts Prospecting in the rows Needs action, Waiting, No next step, by urgency. On a card that has
 * the focus: `E` Change stage…, `S` Change status…, the arrows go from card to card.
 */
function Board({
  cards,
  summary,
  today,
  onOpen,
}: {
  cards: Card[];
  summary: Summary;
  today: string;
  onOpen: OpenGesture;
}) {
  const [dragged, setDragged] = useState<Dragged>(null);
  // No drag by touch (ST-61): a card is moved from its record on a phone.
  const pointerType = useRef('');
  const stages = funnelOf(summary.stages);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const row = event.target instanceof HTMLElement ? event.target : undefined;
    const contactId = row?.getAttribute('role') === 'row' ? row.dataset['key'] : undefined;
    if (!row || !contactId || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'e' || event.key === 'E') onOpen(contactId, { stageTo: 'choose' });
    else if (event.key === 's' || event.key === 'S') onOpen(contactId, { statusTo: 'choose' });
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      cardBeside(row, event.key === 'ArrowLeft' ? -1 : 1)?.focus();
    } else return;
    event.preventDefault();
  };
  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- the keys of the cards, each a row of a grid that has the focus.
    <div
      data-funnel-board
      onKeyDown={onKeyDown}
      onPointerDownCapture={(event) => {
        pointerType.current = event.pointerType;
      }}
      onDragStartCapture={(event) => {
        if (pointerType.current === 'touch') event.preventDefault();
      }}
      className="overflow-x-auto pb-2"
    >
      <div
        className="grid gap-x-3 gap-y-2"
        style={{
          gridTemplateColumns: `7rem repeat(${stages.length}, minmax(15rem, 1fr))`,
          gridTemplateRows: `auto repeat(${ROWS.length}, auto)`,
        }}
      >
        {ROWS.map((row, index) => (
          <div
            key={row.id}
            aria-hidden="true"
            style={{ gridColumn: 1, gridRow: index + 2 }}
            className="pt-2 text-xs font-semibold text-muted-foreground uppercase"
          >
            {row.label()}
          </div>
        ))}
        {stages.map((stage, index) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            column={index + 2}
            cards={cards.filter(({ contact }) => contact.stageId === stage.id)}
            summary={summary}
            today={today}
            dragged={dragged}
            onDrag={setDragged}
            onDropToStage={(contactId, stageId) => onOpen(contactId, { stageTo: stageId })}
            onOpen={onOpen}
          />
        ))}
      </div>
      {dragged && <StatusZones onDropToStatus={onOpen} />}
    </div>
  );
}

/** Kanban or table, also by `V` (spec UX §3.3, §5.2). */
function ViewSwitch({
  view,
  onChange,
}: {
  view: FunnelView;
  onChange: (view: FunnelView) => void;
}) {
  const { singleKeyShortcuts } = useSettings();
  return (
    <SegmentedControl
      data-funnel-view
      value={view}
      onChange={(value) => {
        if (isFunnelView(value)) onChange(value);
      }}
    >
      <Label>
        {m.funnel_view()}
        {singleKeyShortcuts && <Kbd>V</Kbd>}
      </Label>
      <SegmentedControlItems>
        <SegmentedControlItem value="kanban">{m.funnel_view_kanban()}</SegmentedControlItem>
        <SegmentedControlItem value="table">{m.funnel_view_table()}</SegmentedControlItem>
      </SegmentedControlItems>
    </SegmentedControl>
  );
}

/** The Contacts Prospecting, with what they have next, by urgency, then by name. */
function cardsOf(summary: Summary, today: string): Card[] {
  return summary.contacts
    .filter(({ status }) => status === 'prospecting')
    .map((contact) => ({ contact, agenda: agendaOf(contact, summary, today) }))
    .toSorted(
      (a, b) => byUrgency(a.agenda, b.agenda) || a.contact.name.localeCompare(b.contact.name),
    );
}

/**
 * The Funnel (spec UX §5.2): the kanban of the Contacts Prospecting, its filters, and the record of a
 * Contact in a panel beside it, not modal. A gesture opened from a card, a drop, or the record, opens
 * in the same panel as anywhere else, kept by the address (ST-70).
 */
export function FunnelScreen() {
  useLocale();
  const api = useApi();
  const navigate = useNavigate();
  const addContact = useAddContact();
  const isNarrow = useIsNarrow();
  const { data: summary, isError } = useQuery(summaryQuery(api));
  const current = useSearch({ from: '/app/funnel' });
  const { contact: contactId, panel } = current;
  const gestures = useRecordGestures();
  const [filters, setFilters] = useState(NO_FILTERS);
  const typed = useDeferredValue(filters.text);
  const [view, setView] = useFunnelView();
  useSingleKeyShortcuts({
    v: (event) => {
      if (isModalOpen() || isNarrow) return;
      event.preventDefault();
      const wasInView = document.activeElement?.closest('[data-funnel-view-content]') != null;
      flushSync(() => setView(view === 'table' ? 'kanban' : 'table'));
      // The focus was in the view that went: it goes into the one that comes, not back to the page.
      if (wasInView) {
        document.querySelector<HTMLElement>('[data-funnel-view-content] [role="grid"]')?.focus();
      }
    },
  });
  // The record opened takes the focus once (ST-66).
  const focusHeading = useCallback((heading: HTMLHeadingElement | null) => heading?.focus(), []);

  const onOpen: OpenGesture = (id, search) => {
    // On a phone, the record is a page.
    if (search.panel === 'record' && isNarrow) {
      void navigate({ to: '/contacts/$contactId', params: { contactId: id } });
      return;
    }
    void navigate({
      to: '/funnel',
      // Another Contact: what was open on the previous one closes.
      search: { ...(contactId === id ? current : {}), contact: id, ...search },
    });
  };
  const closePanel = () => {
    void navigate({ to: '/funnel', search: ({ panel: _closed, ...search }) => search }).then(() => {
      if (contactId) {
        document.querySelector<HTMLElement>(`[role="row"][data-key="${contactId}"]`)?.focus();
      }
    });
  };

  if (summary === undefined) {
    return (
      <Screen title={m.funnel()}>
        <ErrorMessage>{isError && m.funnel_load_error()}</ErrorMessage>
      </Screen>
    );
  }
  const today = todayOf(summary);
  const all = cardsOf(summary, today);
  const shown = all.filter((card) => matches(card, { ...filters, text: typed }, summary));
  const contact = summary.contacts.find(({ id }) => id === contactId);
  const isFiltered = Object.values(filters).some((value) => value !== '');
  return (
    <Screen title={m.funnel()}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FilterBar filters={filters} onChange={setFilters} summary={summary} />
        {!isNarrow && <ViewSwitch view={view} onChange={setView} />}
      </div>
      {all.length === 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">{m.funnel_empty()}</p>
          <Button aria-keyshortcuts="N" onPress={addContact}>
            {m.add_contact()}
            <Kbd>N</Kbd>
          </Button>
        </div>
      )}
      {all.length > 0 && shown.length === 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted-foreground">{m.funnel_no_match()}</p>
          {isFiltered && (
            <Button variant="outline" size="sm" onPress={() => setFilters(NO_FILTERS)}>
              {m.funnel_clear_filters()}
            </Button>
          )}
        </div>
      )}
      <div
        className={cn(
          'grid items-start gap-4',
          panel === 'record' && contact && 'md:grid-cols-[minmax(0,1fr)_22rem]',
        )}
      >
        <div data-funnel-view-content className="min-w-0">
          {isNarrow ? (
            <FunnelList cards={shown} summary={summary} today={today} onOpen={onOpen} />
          ) : view === 'table' ? (
            <FunnelTable cards={shown} summary={summary} today={today} onOpen={onOpen} />
          ) : (
            <Board cards={shown} summary={summary} today={today} onOpen={onOpen} />
          )}
        </div>
        {panel === 'record' && contactId && !isNarrow && (
          <div className="sticky top-4">
            <ContactPanel
              key={contactId}
              contactId={contactId}
              headingRef={focusHeading}
              onClose={closePanel}
            />
          </div>
        )}
      </div>
      {/* Opened from a card, without the record: the gesture alone. */}
      {panel !== 'record' && contact && (
        <RecordGesturePanels contact={contact} summary={summary} gestures={gestures} />
      )}
    </Screen>
  );
}
