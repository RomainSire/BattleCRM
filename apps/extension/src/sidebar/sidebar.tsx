import { m } from '@battlecrm/i18n';
import { Button, OnlineContext } from '@battlecrm/ui';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-aria-components';

import { profileUrlOf } from '../linkedin/profile.ts';
import { isSearchPage } from '../linkedin/search.ts';
import type { NewContact, Send, Session, StageChoice, UndoOutcome } from '../messages.ts';
import type { WatchActiveTab } from './active-tab.ts';
import { AddContactForm, draftOf, type Draft } from './add-contact.tsx';
import { AddedLine } from './added-line.tsx';
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
  // `undefined` until the tab is known; `null` off a profile and a search.
  const [shown, setShown] = useState<{ tabId: number; url: string; search: boolean } | null>();
  useEffect(
    () =>
      watchActiveTab((tab) => {
        if (tab === undefined) return setShown(null);
        const url = profileUrlOf(tab.url);
        if (url !== null) return setShown({ tabId: tab.id, url, search: false });
        setShown(isSearchPage(tab.url) ? { tabId: tab.id, url: tab.url, search: true } : null);
      }),
    [watchActiveTab],
  );
  if (shown === undefined) return null;
  if (shown === null) return <Elsewhere />;
  if (shown.search)
    return <Search key={`${shown.tabId} ${shown.url}`} url={shown.url} tabId={shown.tabId} />;
  // Another profile, or another tab: what the form held is lost, without asking (spec extension §4).
  return (
    <Profile
      key={`${shown.tabId} ${shown.url}`}
      url={shown.url}
      tabId={shown.tabId}
      appOrigin={appOrigin}
    />
  );
}

/** What the line after an addition says, by the Status the Contact was added in (§13, A9). */
function addedMessage({ status, stageId }: NewContact, stages: readonly StageChoice[]) {
  if (status === 'ally') return m.extension_added_ally();
  if (status === 'pool') return m.extension_added_pool();
  const stage = stages.find(({ id }) => id === stageId) ?? stages[0];
  return m.extension_added_prospecting({ stage: stage?.name ?? '' });
}

/**
 * A LinkedIn profile: the card of its Contact, or the form to add one. After an addition, the card,
 * and a line to undo it, which brings the form back as it was sent (spec extension §4).
 */
function Profile({ url, tabId, appOrigin }: { url: string; tabId: number; appOrigin: string }) {
  const send = useSend();
  const queryClient = useQueryClient();
  const lookupKey = ['lookup', tabId, url];
  // Read again each time the profile is shown again: the Contact may have changed in the app since.
  const lookup = useQuery({
    queryKey: lookupKey,
    queryFn: () => send({ type: 'lookup', url, tabId }),
    gcTime: 0,
  });
  const readAgain = () => queryClient.refetchQueries({ queryKey: lookupKey });
  // “Read the page again” (spec extension §4): waits for LinkedIn to show the profile, 10 s at most.
  const pageRead = useMutation({
    mutationFn: async () => {
      const answer = await send({ type: 'lookup', url, tabId, wait: true });
      queryClient.setQueryData(lookupKey, answer);
      return answer;
    },
  });
  const { mutate: readPage } = pageRead;
  // What the User changed in the form: the rest follows what the page reads.
  const [edits, setEdits] = useState<Partial<Draft>>({});
  const [added, setAdded] = useState<{ undoToken: string; message: string }>();
  /** The session's own screens come first (spec extension §3): the background tells which. */
  const followSession = useCallback(
    (status: string | undefined) => {
      if (status === 'signedOut') void queryClient.invalidateQueries({ queryKey: sessionKey });
      if (status === 'outdated')
        queryClient.setQueryData<Session>(sessionKey, { status: 'outdated' });
    },
    [queryClient],
  );
  const add = useMutation({
    mutationFn: async ({ contact, stages }: { contact: NewContact; stages: StageChoice[] }) => {
      const outcome = await send({ type: 'addContact', tabId, contact });
      followSession(outcome.status);
      if (outcome.status === 'added')
        setAdded({ undoToken: outcome.undoToken, message: addedMessage(contact, stages) });
      // Added, taken from another tab meanwhile, or the Funnel and the Organizations changed in the
      // app: the profile is read again, the form waiting until then.
      const changed =
        outcome.status === 'added' ||
        outcome.status === 'taken' ||
        (outcome.status === 'refused' && outcome.error !== 'error');
      if (changed) await readAgain();
      return outcome;
    },
  });
  const undo = useMutation({
    mutationFn: async (undoToken: string) => {
      const outcome = await send({ type: 'undo', tabId, undoToken });
      followSession(outcome.status);
      if (outcome.status === 'undone') {
        await readAgain();
        setAdded(undefined);
        add.reset();
      }
      return outcome;
    },
  });
  const endLine = useCallback(() => setAdded(undefined), []);
  const status = lookup.data?.status;
  useEffect(() => followSession(status), [status, followSession]);
  // The name not read: LinkedIn may not have shown the profile yet. Read again, once, on its own.
  const nameUnread = status === 'notContact' && lookup.data?.reading === null;
  const readOnItsOwn = useRef(false);
  useEffect(() => {
    if (!nameUnread || readOnItsOwn.current) return;
    readOnItsOwn.current = true;
    readPage();
  }, [nameUnread, readPage]);

  if (lookup.isPending) return null;
  if (lookup.isError || lookup.data.status === 'error') {
    return <Unreachable onRetry={() => void lookup.refetch()} isRetrying={lookup.isFetching} />;
  }
  if (lookup.data.status === 'contact') {
    return (
      <>
        {added !== undefined && (
          <AddedLine
            message={added.message}
            onUndo={() => undo.mutate(added.undoToken)}
            isUndoing={undo.isPending}
            error={undoError(undo.isError, undo.data)}
            onEnd={endLine}
          />
        )}
        <ContactCardView contact={lookup.data.contact} appOrigin={appOrigin} />
      </>
    );
  }
  if (lookup.data.status !== 'notContact') return null;
  const { reading, sameName, organizations, stages } = lookup.data;
  const current: Draft = { ...draftOf(reading, organizations), ...edits };
  return (
    <AddContactForm
      linkedinUrl={url}
      appOrigin={appOrigin}
      sameName={sameName}
      organizations={organizations}
      stages={stages}
      draft={current}
      onChange={(fields) => setEdits((previous) => ({ ...previous, ...fields }))}
      onReadAgain={() => readPage()}
      isReading={pageRead.isPending}
      // Once the page was read again, waiting for the profile: never while it may still show.
      unreadable={reading === null && (pageRead.isSuccess || pageRead.isError)}
      // The edits stay: “Undo” brings the form back as sent, the page read again.
      onAdd={(contact) => add.mutate({ contact, stages })}
      isAdding={add.isPending}
      outcome={add.data}
      failed={add.isError}
    />
  );
}

/** Why “Undo” failed, as the line says it. */
function undoError(failed: boolean, outcome: UndoOutcome | undefined) {
  if (failed) return m.undo_failed();
  if (outcome?.status !== 'refused') return false;
  return outcome.error === 'error' ? m.undo_failed() : m.undo_too_late();
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

/**
 * A search of people: what to open, as elsewhere, unless it shows no result the extension reads (spec
 * extension §3, §7). Read once per address, when the sidebar opens and at each page of the search.
 */
function Search({ url, tabId }: { url: string; tabId: number }) {
  const send = useSend();
  const reading = useQuery({
    queryKey: ['readSearch', tabId, url],
    queryFn: () => send({ type: 'readSearch', url, tabId }),
    gcTime: 0,
  });
  if (reading.data !== 'unreadable') return <Elsewhere />;
  return (
    <>
      <h1 className="sr-only">BattleCRM</h1>
      {/* A status, as the alert of an unreadable profile: said by a screen reader once the wait is over. */}
      <output className="block text-muted-foreground">{m.extension_unreadable_search()}</output>
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
