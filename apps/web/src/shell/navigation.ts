import { m } from '@battlecrm/i18n';
import type { ToOptions } from '@tanstack/react-router';
import {
  ChartLine,
  Contact,
  Ellipsis,
  Funnel,
  MessageSquareText,
  Settings,
  Star,
  Sun,
  Swords,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Path = NonNullable<ToOptions['to']>;

export type NavigationEntry = {
  to: Path;
  label: () => string;
  icon: LucideIcon;
  /** Other screens below this entry, which keep it current. */
  alsoCurrentOn?: Path[];
};

const today: NavigationEntry = { to: '/today', label: m.today, icon: Sun };
const circle: NavigationEntry = { to: '/circle', label: m.circle, icon: Star };
const contacts: NavigationEntry = { to: '/contacts', label: m.contacts, icon: Contact };
const funnel: NavigationEntry = { to: '/funnel', label: m.funnel, icon: Funnel };
const battles: NavigationEntry = { to: '/battles', label: m.battles, icon: Swords };
const positionings: NavigationEntry = {
  to: '/positionings',
  label: m.positionings,
  icon: MessageSquareText,
};
const insights: NavigationEntry = { to: '/insights', label: m.insights, icon: ChartLine };
export const settings: NavigationEntry = { to: '/settings', label: m.settings, icon: Settings };

// Desktop sidebar groups (spec UX §3.1).
export const prospecting = [today, circle, contacts, funnel];
export const experimentation = [battles, positionings, insights];

// Mobile: the bottom tabs are the Prospecting group without the Circle, then More (spec UX §3.2).
export const underMore = [circle, battles, insights, settings];
export const underMoreOnDesktop = [positionings];
const more: NavigationEntry = {
  to: '/more',
  label: m.more,
  icon: Ellipsis,
  alsoCurrentOn: [...underMore, ...underMoreOnDesktop].map((entry) => entry.to),
};
export const tabs = [today, contacts, funnel, more];
