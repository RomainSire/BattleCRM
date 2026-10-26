import {
  DEFAULT_ACTIVITY_GOAL,
  DEFAULT_BATTLE_HORIZON,
  DEFAULT_BATTLE_THRESHOLD,
  DEFAULT_CELEBRATE_GOAL,
  DEFAULT_CHECK_IN_RHYTHM_DAYS,
  DEFAULT_CIRCLE_SIZE_GOAL,
  DEFAULT_ENTRY_GOAL,
  DEFAULT_FOLLOW_UP_INTERVALS,
  DEFAULT_RESPONSE_WINDOW_DAYS,
  DEFAULT_SINGLE_KEY_SHORTCUTS,
  summary as summarySchema,
  summaryBattle,
  summaryChanges,
  summaryContact,
  summaryOrganization,
  summaryPositioning,
  summarySettings,
  summaryStage,
  type Summary,
  type SummaryBattle,
  type SummaryChanges,
  type SummaryContact,
  type SummaryOrganization,
  type SummaryPositioning,
  type SummarySettings,
  type SummaryStage,
} from '@battlecrm/contract';

// Test data built from the contract: a test gives only the fields it is about, the rest is
// neutral. Each builder checks its result against the contract, so a stale field fails at once.

/** The time zone of this device: what the SPA reads today in when nothing else says. */
export const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

let lastId = 0;
/** A fresh uuidv7-shaped id, for a row whose id the test never names: from 0xf00001, far above the ids tests write by hand. */
const nextId = () =>
  `01990000-0000-7000-8000-${(0xf00000 + ++lastId).toString(16).padStart(12, '0')}`;

/** A Contact of the summary: in the Pool, without coordinates, added on 2026-01-05. */
export const contact = (fields: Partial<SummaryContact> = {}): SummaryContact =>
  summaryContact.parse({
    id: nextId(),
    name: 'Jean Dupont',
    status: 'pool',
    stageId: null,
    organizationId: null,
    jobTitle: null,
    email: null,
    phone: null,
    linkedinUrl: null,
    lastInteractionAt: '2026-01-05T09:00:00.000Z',
    lastInteractionOn: '2026-01-05',
    lastDoneInteractionOn: null,
    funnelEntryDays: [],
    stageEnteredOn: null,
    statusReason: null,
    followUp: null,
    prospectingActionDays: [],
    assignment: null,
    trial: null,
    lastPositioningUse: null,
    ...fields,
  } satisfies SummaryContact);

/** A Stage of the Funnel, not archived, without an aim, that never served. */
export const stage = (fields: Partial<SummaryStage> = {}): SummaryStage =>
  summaryStage.parse({
    id: nextId(),
    name: 'Approche',
    aim: null,
    archived: false,
    served: false,
    ...fields,
  } satisfies SummaryStage);

/** An Organization, a consultancy. */
export const organization = (fields: Partial<SummaryOrganization> = {}): SummaryOrganization =>
  summaryOrganization.parse({
    id: nextId(),
    name: 'Capgemini',
    type: 'consultancy',
    ...fields,
  } satisfies SummaryOrganization);

/** A Positioning by e-mail, never used, with the default cadence and no attachment. */
export const positioning = (
  fields: Partial<SummaryPositioning> & Pick<SummaryPositioning, 'stageId'>,
): SummaryPositioning =>
  summaryPositioning.parse({
    id: nextId(),
    label: 'CV Rust',
    channel: 'email',
    content: null,
    followUps: DEFAULT_FOLLOW_UP_INTERVALS.map((days) => ({ days, message: null })),
    responseWindowDays: DEFAULT_RESPONSE_WINDOW_DAYS,
    derivedFromId: null,
    archived: false,
    attachments: [],
    used: false,
    trialCount: 0,
    archivedByBattle: null,
    ...fields,
  } satisfies SummaryPositioning);

/** No Trial for a Positioning of a Battle. */
const NO_TRIALS = { successes: 0, noResults: 0, inProgress: 0 };

/** An open Battle, for every Target, at 85 % and an Horizon of 25, opened on 2026-01-05. */
export const battle = (
  fields: Partial<SummaryBattle> & Pick<SummaryBattle, 'stageId' | 'championId' | 'challengerId'>,
): SummaryBattle =>
  summaryBattle.parse({
    id: nextId(),
    successCriterion: 'a répondu positivement',
    target: null,
    threshold: DEFAULT_BATTLE_THRESHOLD,
    horizon: DEFAULT_BATTLE_HORIZON,
    openedOn: '2026-01-05',
    open: true,
    startedTrials: 0,
    finishedTrials: 0,
    trials: { champion: NO_TRIALS, challenger: NO_TRIALS },
    closedOn: null,
    verdict: null,
    designated: false,
    takeaway: null,
    ...fields,
  } satisfies SummaryBattle);

/** Settings as a new User has them, in French, in `timeZone`. */
export const settings = (
  fields: Partial<SummarySettings> = {},
  timeZone = DEVICE_TIME_ZONE,
): SummarySettings =>
  summarySettings.parse({
    locale: 'fr',
    timeZone: { inEffect: timeZone, chosen: timeZone },
    activityGoal: { inEffect: DEFAULT_ACTIVITY_GOAL, chosen: DEFAULT_ACTIVITY_GOAL },
    entryGoal: { inEffect: DEFAULT_ENTRY_GOAL, chosen: DEFAULT_ENTRY_GOAL },
    celebrateGoal: DEFAULT_CELEBRATE_GOAL,
    singleKeyShortcuts: DEFAULT_SINGLE_KEY_SHORTCUTS,
    checkInRhythmDays: DEFAULT_CHECK_IN_RHYTHM_DAYS,
    circleSizeGoal: DEFAULT_CIRCLE_SIZE_GOAL,
    defaultCadence: {
      intervals: [...DEFAULT_FOLLOW_UP_INTERVALS],
      responseWindowDays: DEFAULT_RESPONSE_WINDOW_DAYS,
    },
    ...fields,
  } satisfies SummarySettings);

/** The whole summary: empty, Settings of a new User in `timeZone` (this device's by default). */
export function summary(
  fields: Partial<Omit<Summary, 'settings'>> & { settings?: Partial<SummarySettings> } = {},
): Summary {
  const timeZone = fields.timeZone ?? DEVICE_TIME_ZONE;
  return summarySchema.parse({
    timeZone,
    celebratedOn: null,
    contacts: [],
    stages: [],
    organizations: [],
    positionings: [],
    battles: [],
    deletedContactDays: { funnelEntryDays: [], prospectingActionDays: [] },
    ...fields,
    settings: settings(fields.settings, timeZone),
  } satisfies Summary);
}

/** The rows a gesture answers with: none but those given. */
export const changes = (fields: Partial<SummaryChanges> = {}): SummaryChanges =>
  summaryChanges.parse({
    contacts: [],
    removedContactIds: [],
    organizations: [],
    removedOrganizationIds: [],
    positionings: [],
    removedPositioningIds: [],
    battles: [],
    removedBattleIds: [],
    stages: null,
    deletedContactDays: null,
    ...fields,
  } satisfies SummaryChanges);
