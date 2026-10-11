import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import type { NavigateOptions, RouterHistory, ToOptions } from '@tanstack/react-router';
import { m } from '@battlecrm/i18n';
import { RouterProvider } from 'react-aria-components';

import { AuthLayout } from './auth/auth-layout.tsx';
import { SignInScreen } from './auth/sign-in-screen.tsx';
import { SignUpScreen } from './auth/sign-up-screen.tsx';
import { AuthError, InvalidLinkScreen, VerifyingEmail } from './auth/verify-email-screen.tsx';
import { MoreScreen } from './screens/more-screen.tsx';
import { Screen } from './screens/screen.tsx';
import { configQuery, sessionQuery, type ApiClient } from './session.ts';
import { AppShell } from './shell/app-shell.tsx';

type RouterContext = { queryClient: QueryClient; api: ApiClient };

/** Any React Aria component with an `href` navigates through TanStack Router. */
function Root() {
  const router = useRouter();
  return (
    <RouterProvider
      navigate={(to, options) => router.navigate({ ...options, to })}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      <Outlet />
    </RouterProvider>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Root });

/** `null` without a session; `undefined` when the API cannot say (offline: the app stays readable, ADR 0004). */
const currentSession = ({ queryClient, api }: RouterContext) =>
  queryClient.query(sessionQuery(api)).catch(() => undefined);

// Every screen of the app: without a session, it leads to signing in.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context }) => {
    if ((await currentSession(context)) === null) throw redirect({ to: '/sign-in', replace: true });
  },
  component: AppShell,
});

// The screens shown without a session (spec UX §5.9).
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  // What a visitor may do, known before the first render; a failure shows on the screen that needs it.
  loader: ({ context }) =>
    context.queryClient.query(configQuery(context.api)).catch(() => undefined),
  component: AuthLayout,
  errorComponent: AuthError,
});

/** Signing in or up makes no sense with a session: back to the app. */
const redirectSignedIn = async ({ context }: { context: RouterContext }) => {
  if (await currentSession(context)) throw redirect({ to: '/today', replace: true });
};

const signInRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-in',
  beforeLoad: redirectSignedIn,
  component: SignInScreen,
});

const signUpRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-up',
  beforeLoad: redirectSignedIn,
  component: SignUpScreen,
});

// The link of the verification e-mail. Its token travels in the fragment, which reaches no server log,
// and is posted by the loader: once per visit, where an effect would run twice in development.
const verifyEmailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/verify-email',
  loader: async ({ context: { api, queryClient }, location }) => {
    const response = await api.signup.verify.$post({ json: { token: location.hash } });
    if (response.status === 400) return;
    if (!response.ok) throw new Error('POST /api/signup/verify failed');
    // The click signs this device in, and lands on Today without a toast.
    queryClient.setQueryData(sessionQuery(api).queryKey, await response.json());
    throw redirect({ to: '/today', replace: true });
  },
  // The link works once: never ask again for the same visit.
  staleTime: Infinity,
  pendingComponent: VerifyingEmail,
  component: InvalidLinkScreen,
});

// Today is the landing screen (spec UX §3.2).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today', replace: true });
  },
});

const todayRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/today',
  component: () => <Screen title={m.today()} />,
});

const circleRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/circle',
  component: () => <Screen title={m.circle()} />,
});

const contactsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/contacts',
  component: () => <Screen title={m.contacts()} />,
});

const funnelRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/funnel',
  component: () => <Screen title={m.funnel()} />,
});

const battlesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/battles',
  component: () => <Screen title={m.battles()} />,
});

const positioningsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/positionings',
  component: () => <Screen title={m.positionings()} />,
});

const insightsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/insights',
  component: () => <Screen title={m.insights()} />,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: () => <Screen title={m.settings()} />,
});

const moreRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/more',
  component: MoreScreen,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([
    todayRoute,
    circleRoute,
    contactsRoute,
    funnelRoute,
    battlesRoute,
    positioningsRoute,
    insightsRoute,
    settingsRoute,
    moreRoute,
  ]),
  authRoute.addChildren([signInRoute, signUpRoute, verifyEmailRoute]),
]);

export function createAppRouter({
  history,
  ...context
}: RouterContext & { history?: RouterHistory }) {
  return createRouter({ routeTree, context, ...(history === undefined ? {} : { history }) });
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
