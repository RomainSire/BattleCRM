import { m } from '@battlecrm/i18n';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';

/** The sessions of the User, this device first. */
export const sessionsQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await api.sessions.$get();
      if (!response.ok) throw new Error('GET /api/sessions failed');
      return (await response.json()).sessions;
    },
  });

/**
 * Connected devices (spec UX §5.9): browser and system, last activity, “Sign out” on each of the others
 * and “Sign out all the others”. No confirmation and no password: ending a session is not a sensitive action.
 */
export function ConnectedDevices() {
  const locale = useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const sessions = useQuery(sessionsQuery(api));
  // Whatever the answer, the list is read again: it shows what the API knows.
  const onSettled = () => queryClient.invalidateQueries({ queryKey: sessionsQuery(api).queryKey });
  const signOutOne = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.sessions[':id'].revoke.$post({ param: { id } });
      // 404: the session ended in the meantime, which is what was asked for.
      if (!response.ok && response.status !== 404) {
        throw new Error('POST /api/sessions/:id/revoke failed');
      }
    },
    onSettled,
  });
  const signOutOthers = useMutation({
    mutationFn: async () => {
      const response = await api.sessions['revoke-others'].$post();
      if (!response.ok) throw new Error('POST /api/sessions/revoke-others failed');
    },
    onSettled,
  });
  const busy = signOutOne.isPending || signOutOthers.isPending;
  // To the day: it is all the API knows of a session in use (ST-16).
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="text-sm font-medium">
        {m.devices_title()}
      </h3>
      {sessions.data && (
        <ul aria-labelledby={titleId} className="flex flex-col divide-y">
          {sessions.data.map((session) => {
            const device = [
              session.browser ?? m.device_unknown_browser(),
              session.os ?? m.device_unknown_os(),
            ].join(' · ');
            return (
              <li key={session.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{device}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.current
                      ? m.devices_this_device()
                      : m.devices_last_active({ date: day.format(new Date(session.lastActiveAt)) })}
                  </span>
                </div>
                {!session.current && (
                  <Button
                    variant="outline"
                    className="max-md:min-h-11"
                    aria-label={m.devices_sign_out_named({ device })}
                    isDisabled={busy}
                    onPress={() => signOutOne.mutate(session.id)}
                  >
                    {m.devices_sign_out()}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {sessions.data?.some((session) => !session.current) && (
        <Button
          variant="outline"
          className="self-start max-md:min-h-11"
          isDisabled={busy}
          onPress={() => signOutOthers.mutate()}
        >
          {m.devices_sign_out_others()}
        </Button>
      )}
      <ErrorMessage>
        {(sessions.isError || signOutOne.isError || signOutOthers.isError) && m.auth_error()}
      </ErrorMessage>
    </div>
  );
}
