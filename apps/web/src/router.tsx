import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router';
import type { NavigateOptions, RouterHistory, ToOptions } from '@tanstack/react-router';
import { m } from '@battlecrm/i18n';

import { MoreScreen } from './screens/more-screen.tsx';
import { Screen } from './screens/screen.tsx';
import { AppShell } from './shell/app-shell.tsx';

const rootRoute = createRootRoute({ component: AppShell });

// Today is the landing screen (spec UX §3.2).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today', replace: true });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: () => <Screen title={m.today()} />,
});

const circleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/circle',
  component: () => <Screen title={m.circle()} />,
});

const contactsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contacts',
  component: () => <Screen title={m.contacts()} />,
});

const funnelRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/funnel',
  component: () => <Screen title={m.funnel()} />,
});

const battlesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/battles',
  component: () => <Screen title={m.battles()} />,
});

const positioningsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/positionings',
  component: () => <Screen title={m.positionings()} />,
});

const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/insights',
  component: () => <Screen title={m.insights()} />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <Screen title={m.settings()} />,
});

const moreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/more',
  component: MoreScreen,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  todayRoute,
  circleRoute,
  contactsRoute,
  funnelRoute,
  battlesRoute,
  positioningsRoute,
  insightsRoute,
  settingsRoute,
  moreRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history === undefined ? {} : { history }) });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

// React Aria's links and collections navigate through TanStack Router, with typed paths.
declare module 'react-aria-components' {
  interface RouterConfig {
    href: NonNullable<ToOptions['to']>;
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}
