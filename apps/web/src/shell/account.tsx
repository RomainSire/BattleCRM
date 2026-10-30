import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { cn } from 'cn';
import { LogOut } from 'lucide-react';

import { clearDeviceData } from '../device-data.ts';
import { sessionQuery, useApi } from '../session.ts';

/** The address of the account and “Sign out”: this device only, without a confirmation (spec UX §5.9). */
export function Account({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const { data: session } = useQuery(sessionQuery(useApi()));
  const signOut = useSignOut();
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      {session && (
        <span className="truncate px-2 py-1 text-xs text-muted-foreground" title={session.email}>
          {session.email}
        </span>
      )}
      <Button
        variant="ghost"
        className={cn(
          'justify-start gap-2 px-2 font-normal text-muted-foreground',
          buttonClassName,
        )}
        isDisabled={signOut.isPending}
        saves
        onPress={() => signOut.mutate()}
      >
        <LogOut />
        {m.sign_out()}
      </Button>
      <ErrorMessage className="px-2">{signOut.isError && m.auth_error()}</ErrorMessage>
    </div>
  );
}

/** Signs out of this device, what it kept cleared, then leads to signing in (spec UX §5.9). */
export function useSignOut() {
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      const response = await api.auth['sign-out'].$post();
      if (!response.ok) throw new Error('POST /api/auth/sign-out failed');
    },
    onSuccess: async () => {
      clearDeviceData(queryClient);
      queryClient.setQueryData(sessionQuery(api).queryKey, null);
      await router.navigate({ to: '/sign-in', replace: true });
    },
  });
}
