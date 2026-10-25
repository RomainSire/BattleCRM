import { SIGNUP_RESEND_DELAY_SECONDS } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '../components/ui/button.tsx';
import { useApi } from '../session.ts';
import { AuthScreen } from './auth-layout.tsx';

/** “Check your inbox”: the same screen whether the address was free or already had an account (ST-13). */
export function CheckInbox({
  attemptId,
  email,
  onWrongAddress,
}: {
  attemptId: string;
  email: string;
  onWrongAddress: () => void;
}) {
  const api = useApi();
  const [sendableAt, setSendableAt] = useState(
    () => Date.now() + SIGNUP_RESEND_DELAY_SECONDS * 1000,
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const secondsLeft = Math.max(0, Math.ceil((sendableAt - now) / 1000));

  const resend = useMutation({
    mutationFn: async () => {
      const response = await api.signup.resend.$post({ json: { attemptId } });
      if (response.status === 429) return (await response.json()).retryAfterSeconds;
      if (!response.ok) throw new Error(`POST /api/signup/resend answered ${response.status}`);
      return SIGNUP_RESEND_DELAY_SECONDS;
    },
    onSuccess: (waitSeconds) => {
      setNow(Date.now());
      setSendableAt(Date.now() + waitSeconds * 1000);
    },
  });
  const resent = resend.isSuccess && resend.data === SIGNUP_RESEND_DELAY_SECONDS;

  return (
    <AuthScreen title={m.auth_check_inbox_title()}>
      <p>{m.auth_check_inbox_body({ email })}</p>
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          isDisabled={secondsLeft > 0 || resend.isPending}
          saves
          onPress={() => resend.mutate()}
        >
          {secondsLeft > 0 ? m.auth_resend_link_in({ seconds: secondsLeft }) : m.auth_resend_link()}
        </Button>
        <Button variant="link" className="h-auto px-0" onPress={onWrongAddress}>
          {m.auth_wrong_address()}
        </Button>
      </div>
      {/* Always there, so that a screen reader announces what appears in it. */}
      <output className="text-sm text-muted-foreground empty:sr-only">
        {resent && m.auth_link_resent()}
        {resend.isError && m.auth_error()}
      </output>
    </AuthScreen>
  );
}
