import { m } from '@battlecrm/i18n';
import { Button, OnlineContext } from '@battlecrm/ui';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-aria-components';

import { profileUrlOf } from '../linkedin/profile.ts';
import type { Send, Session } from '../messages.ts';
import type { WatchActiveTab } from './active-tab.ts';
import { ContactCardView } from './contact-card.tsx';
import { linkClass, ScreenTitle } from './layout.tsx';
import { SendContext, useSend } from './send.tsx';
import { SignIn } from './sign-in.tsx';
import { useSystemTheme } from './use-system-theme.ts';

const sessionKey = ['session'];

/**
 * The sidebar (spec extension §3): one state, no router. It asks the background through `send()`,
 * which TanStack Query calls instead of `fetch`.
 */
export function Sidebar({
  send,
  appOrigin,
  watchActiveTab,
}: {
  send: Send;
  appOrigin: string;
  watchActiveTab: WatchActiveTab;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // The background answers every failure itself: nothing to retry, and no network to wait for.
        defaultOptions: {
          queries: { retry: false, networkMode: 'always', staleTime: Infinity },
          mutations: { networkMode: 'always' },
        },
      }),
  );
  useSystemTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SendContext value={send}>
        {/* Whether the API answers, the background says: its failure is a screen of its own. */}
        <OnlineContext value>
          <Screens appOrigin={appOrigin} watchActiveTab={watchActiveTab} />
        </OnlineContext>
      </SendContext>
    </QueryClientProvider>
  );
}

/** The screen of the highest priority that applies (spec extension §3). */
function Screens({
  appOrigin,
  watchActiveTab,
}: {
  appOrigin: string;
  watchActiveTab: WatchActiveTab;
}) {
  const send = useSend();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: sessionKey, queryFn: () => send({ type: 'session' }) });
  const show = (session: Session) => queryClient.setQueryData(sessionKey, session);
  const signOut = useMutation({
    mutationFn: () => send({ type: 'signOut' }),
    onSuccess: () => show({ status: 'signedOut' }),
  });

  if (query.isPending) return null;
  // The background answers for the API; a background that does not answer is as unreachable.
  const session: Session = query.isError ? { status: 'unreachable' } : query.data;

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <main className="flex flex-1 flex-col gap-4">
        {session.status === 'outdated' && <Outdated appOrigin={appOrigin} />}
        {session.status === 'signedOut' && <SignIn key="signedOut" onSession={show} />}
        {session.status === 'expired' && (
          <SignIn key="expired" expiredEmail={session.email} onSession={show} />
        )}
        {session.status === 'unreachable' && (
          <Unreachable onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
        )}
        {session.status === 'signedIn' && (
          <ActiveTab appOrigin={appOrigin} watchActiveTab={watchActiveTab} />
        )}
      </main>
      {session.status === 'signedIn' && (
        <footer className="flex items-center justify-between gap-2 border-t pt-3 text-sm">
          <span className="truncate text-muted-foreground">
            {m.extension_signed_in_as({ email: session.email })}
          </span>
          {/* No confirmation, as in the app (spec extension §13, A4). */}
          <Button variant="ghost" isDisabled={signOut.isPending} onPress={() => signOut.mutate()}>
            {m.sign_out()}
          </Button>
        </footer>
      )}
    </div>
  );
}

/**
 * Signed in: what the active tab shows. Its profile is read when the sidebar opens and at each change
 * of profile, never more (spec extension §3).
 */
function ActiveTab({
  appOrigin,
  watchActiveTab,
}: {
  appOrigin: string;
  watchActiveTab: WatchActiveTab;
}) {
  // `undefined` until the tab is known; `null` off a profile.
  const [profileUrl, setProfileUrl] = useState<string | null>();
  useEffect(
    () => watchActiveTab((url) => setProfileUrl(url === undefined ? null : profileUrlOf(url))),
    [watchActiveTab],
  );
  if (profileUrl === undefined) return null;
  if (profileUrl === null) return <Elsewhere />;
  return <Profile key={profileUrl} url={profileUrl} appOrigin={appOrigin} />;
}

/** A LinkedIn profile: the card of its Contact. */
function Profile({ url, appOrigin }: { url: string; appOrigin: string }) {
  const send = useSend();
  const queryClient = useQueryClient();
  // Read again each time the profile is shown again: the Contact may have changed in the app since.
  const lookup = useQuery({
    queryKey: ['lookup', url],
    queryFn: () => send({ type: 'lookup', url }),
    gcTime: 0,
  });
  const status = lookup.data?.status;
  // The session's own screens come first (spec extension §3): the background tells which.
  useEffect(() => {
    if (status === 'signedOut') void queryClient.invalidateQueries({ queryKey: sessionKey });
    if (status === 'outdated')
      queryClient.setQueryData<Session>(sessionKey, { status: 'outdated' });
  }, [status, queryClient]);

  if (lookup.isPending) return null;
  if (lookup.isError || lookup.data.status === 'error') {
    return <Unreachable onRetry={() => void lookup.refetch()} isRetrying={lookup.isFetching} />;
  }
  if (lookup.data.status === 'contact')
    return <ContactCardView contact={lookup.data.contact} appOrigin={appOrigin} />;
  // Not a Contact yet: the form to add one comes with issue 07.
  return <h1 className="sr-only">BattleCRM</h1>;
}

/** 426: the API no longer serves this version. */
function Outdated({ appOrigin }: { appOrigin: string }) {
  return (
    <>
      <ScreenTitle>{m.extension_outdated_title()}</ScreenTitle>
      <p>{m.extension_outdated_body()}</p>
      {/* Where “Install the extension” lives in the app. */}
      <p>
        <Link
          href={`${appOrigin}/settings#preferences`}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          {m.extension_outdated_settings()}
        </Link>
      </p>
    </>
  );
}

/** No answer from the API, or a 5xx. */
function Unreachable({ onRetry, isRetrying }: { onRetry: () => void; isRetrying: boolean }) {
  return (
    <>
      <ScreenTitle>{m.extension_unreachable()}</ScreenTitle>
      <Button variant="outline" className="self-start" isDisabled={isRetrying} onPress={onRetry}>
        {m.extension_retry()}
      </Button>
    </>
  );
}

/** Signed in, on a page that is no LinkedIn profile. */
function Elsewhere() {
  return (
    <>
      <h1 className="sr-only">BattleCRM</h1>
      <p className="text-muted-foreground">{m.extension_elsewhere()}</p>
    </>
  );
}
