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
import { z } from 'zod';

import { createApiClient } from './api-client.ts';
import { AuthLayout } from './auth/auth-layout.tsx';
import { ForgotPasswordScreen } from './auth/forgot-password-screen.tsx';
import { ResetPasswordScreen } from './auth/reset-password-screen.tsx';
import { SignInScreen } from './auth/sign-in-screen.tsx';
import { SignUpScreen } from './auth/sign-up-screen.tsx';
import { CancellingRecovery, RecoveryCancelledScreen } from './auth/two-factor-recovery.tsx';
import { AuthError, InvalidLinkScreen, VerifyingEmail } from './auth/verify-email-screen.tsx';
import { ContactsScreen } from './contacts/contacts-screen.tsx';
import { clearDeviceData } from './device-data.ts';
import { MoreScreen } from './screens/more-screen.tsx';
import { Screen } from './screens/screen.tsx';
import { configQuery, sessionQuery, type ApiClient } from './session.ts';
import { ChangingEmail, InvalidEmailLinkScreen } from './settings/change-email-link.tsx';
import { SettingsScreen } from './settings/settings-screen.tsx';
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

/** Where signing in leads when no page was asked for. */
const LANDING = '/today';

// Zod compiles its object parsers with `new Function`, which the CSP forbids (`script-src 'self'`).
// It must be set before the first schema: Zod probes for eval as soon as one is built.
z.config({ jitless: true });

/**
 * The page a deep link asked for, replayed once signed in (ST-22): a path of this app, never another site.
 * Anything else is dropped rather than refused: no second slash, no backslash, nor any blank a browser would skip.
 */
const destinationSearch = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])\S*$/)
    .optional()
    .catch(undefined),
});

// Every screen of the app: without a session, it leads to signing in, which remembers the page asked for.
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: async ({ context, location }) => {
    if ((await currentSession(context)) !== null) return;
    // A session ended from elsewhere while this device was closed: what it kept goes first (ST-04).
    clearDeviceData(context.queryClient);
    context.queryClient.setQueryData(sessionQuery(context.api).queryKey, null);
    throw redirect({
      to: '/sign-in',
      search: location.href === LANDING ? {} : { redirect: location.href },
      replace: true,
    });
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

/** Signing in or up makes no sense with a session: back to the app, on the page asked for if any. */
const redirectSignedIn = async ({
  context,
  search,
}: {
  context: RouterContext;
  search: z.infer<typeof destinationSearch>;
}) => {
  if (!(await currentSession(context))) return;
  throw search.redirect === undefined
    ? redirect({ to: LANDING, replace: true })
    : redirect({ href: search.redirect, replace: true });
};

const signInRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-in',
  validateSearch: destinationSearch,
  beforeLoad: redirectSignedIn,
  component: SignInScreen,
});

const signUpRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/sign-up',
  beforeLoad: ({ context }) => redirectSignedIn({ context, search: {} }),
  component: SignUpScreen,
});

// Both stay open with a session: “It wasn't me”, in a security e-mail, leads to the first (spec UX §5.9).
const forgotPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/forgot-password',
  component: ForgotPasswordScreen,
});

// The link of the reset e-mail, its token in the fragment like the verification link's.
const resetPasswordRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/reset-password',
  component: ResetPasswordScreen,
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
    // Whatever a previous User left on this device goes before anything is shown.
    clearDeviceData(queryClient);
    queryClient.setQueryData(sessionQuery(api).queryKey, await response.json());
    throw redirect({ to: LANDING, replace: true });
  },
  // The link works once: never ask again for the same visit.
  staleTime: Infinity,
  pendingComponent: VerifyingEmail,
  component: InvalidLinkScreen,
});

// “Cancel”, in the e-mails of a recovery of the second factor (ST-19). Open with or without a session:
// the link is the proof. Posted by the loader, like the verification link.
const cancelRecoveryRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/cancel-two-factor-recovery',
  loader: async ({ context: { api }, location }) => {
    const response = await api['two-factor-recovery'].cancel.$post({
      json: { token: location.hash },
    });
    if (response.status === 400) return false;
    if (!response.ok) throw new Error('POST /api/two-factor-recovery/cancel failed');
    return true;
  },
  // The link works once: never ask again for the same visit.
  staleTime: Infinity,
  pendingComponent: CancellingRecovery,
  component: function CancelRecovery() {
    return <RecoveryCancelledScreen cancelled={cancelRecoveryRoute.useLoaderData()} />;
  },
});

// Today is the landing screen (spec UX §3.2).
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: LANDING, replace: true });
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
  // The Contact whose record is open, as “Open their record” asks for it; anything else is dropped.
  validateSearch: z.object({ contact: z.uuid().optional().catch(undefined) }),
  component: ContactsScreen,
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
  component: SettingsScreen,
});

// The link sent to a new address (spec UX §5.9). It opens no session: without one, signing in comes first
// and leads back here, token included. Posted by the loader, like the verification link.
const changeEmailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/change-email',
  loader: async ({ context: { api, queryClient }, location }) => {
    const response = await api.account.email.confirm.$post({ json: { token: location.hash } });
    if (response.status === 400) return;
    if (!response.ok) throw new Error('POST /api/account/email/confirm failed');
    // The Account section shows the new address.
    queryClient.setQueryData(sessionQuery(api).queryKey, await response.json());
    throw redirect({ to: '/settings', replace: true });
  },
  // The link works once: never ask again for the same visit.
  staleTime: Infinity,
  pendingComponent: ChangingEmail,
  component: InvalidEmailLinkScreen,
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
    changeEmailRoute,
    moreRoute,
  ]),
  authRoute.addChildren([
    signInRoute,
    signUpRoute,
    verifyEmailRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    cancelRecoveryRoute,
  ]),
]);

/**
 * The router and the API client it hands to every screen. `fetch` is how the client reaches the API:
 * the browser's own, unless a test answers in its place.
 */
export function createAppRouter({
  queryClient,
  fetch,
  history,
}: {
  queryClient: QueryClient;
  fetch?: typeof globalThis.fetch;
  history?: RouterHistory;
}) {
  const api = createApiClient(fetch, {
    // A 401 on a device that believed itself signed in: its session was ended from elsewhere.
    // What it kept goes first, then the guard of the app leads to signing in again (ST-04).
    onUnauthenticated: () => {
      const { queryKey } = sessionQuery(api);
      if (!queryClient.getQueryData(queryKey)) return;
      clearDeviceData(queryClient);
      queryClient.setQueryData(queryKey, null);
      void router.invalidate();
    },
  });
  const router = createRouter({
    routeTree,
    context: { api, queryClient },
    ...(history === undefined ? {} : { history }),
  });
  return router;
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
