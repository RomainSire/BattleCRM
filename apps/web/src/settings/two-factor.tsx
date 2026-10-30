import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useId, useState } from 'react';
import { Form } from 'react-aria-components';

import { CodeField } from '../auth/code-field.tsx';
import { PasswordField } from '../auth/password-field.tsx';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { BackupCodes } from './backup-codes.tsx';
import { sessionsQuery } from './connected-devices.tsx';
import { CopyButton } from './copy-button.tsx';

/** Whether the second factor is on, and how many backup codes are left. */
export const twoFactorQuery = (api: ApiClient) =>
  queryOptions({
    queryKey: ['two-factor'],
    queryFn: async () => {
      const response = await api.account['two-factor'].$get();
      if (!response.ok) throw new Error('GET /api/account/two-factor failed');
      return response.json();
    },
  });

/** From this many backup codes left, the User is told to make new ones (spec UX §5.9). */
const FEW_BACKUP_CODES = 3;

type Refusal = 'wrong_password' | 'too_many_attempts' | 'error';

/** What a sensitive request was refused with: the current password went with it (ST-20). */
async function refusalOf(response: Response): Promise<Refusal> {
  if (response.status !== 403 && response.status !== 429) return 'error';
  const { error }: { error?: unknown } = await response.json();
  return error === 'wrong_password' || error === 'too_many_attempts' ? error : 'error';
}

/**
 * Two-factor authentication (spec UX §5.9, ST-18): turned on with the password, a key for the
 * authenticator app and a first code; then 10 backup codes, shown once. Turned off, or its backup
 * codes made anew, with the password again.
 */
export function TwoFactor() {
  useLocale();
  const api = useApi();
  const queryClient = useQueryClient();
  const titleId = useId();
  const status = useQuery(twoFactorQuery(api));
  /** The key waiting for its first code, as an `otpauth://` URI, and the password that asked for it: the code goes with it (ST-20). */
  const [pending, setPending] = useState<{ totpUri: string; password: string }>();
  /** The backup codes being shown, once. */
  const [backupCodes, setBackupCodes] = useState<string[]>();
  /** Turning it on or off opens a new session for this device: both lists are read again. */
  const changed = () => {
    void queryClient.invalidateQueries({ queryKey: twoFactorQuery(api).queryKey });
    void queryClient.invalidateQueries({ queryKey: sessionsQuery(api).queryKey });
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="text-sm font-medium">
        {m.account_two_factor_title()}
      </h3>
      {backupCodes ? (
        <BackupCodes codes={backupCodes} onDone={() => setBackupCodes(undefined)} />
      ) : status.data?.enabled === true ? (
        <TurnedOn
          titleId={titleId}
          backupCodesLeft={status.data.backupCodesLeft}
          onBackupCodes={(codes) => {
            setBackupCodes(codes);
            changed();
          }}
          onTurnedOff={changed}
        />
      ) : pending ? (
        <ConfirmKey
          titleId={titleId}
          {...pending}
          onConfirmed={(codes) => {
            setPending(undefined);
            setBackupCodes(codes);
            changed();
          }}
          onCancel={() => setPending(undefined)}
        />
      ) : (
        status.data && <TurnOn titleId={titleId} onKey={setPending} onAlreadyOn={changed} />
      )}
      <ErrorMessage>{status.isError && m.auth_error()}</ErrorMessage>
    </div>
  );
}

/** Off: the password asks for the key of the authenticator app. */
function TurnOn({
  titleId,
  onKey,
  onAlreadyOn,
}: {
  titleId: string;
  onKey: (pending: { totpUri: string; password: string }) => void;
  onAlreadyOn: () => void;
}) {
  const api = useApi();
  const [password, setPassword] = useState('');
  const start = useMutation({
    mutationFn: async (): Promise<{ totpUri: string } | Refusal | 'already_enabled'> => {
      const response = await api.account['two-factor'].$post({ json: { password } });
      if (response.status === 200) return response.json();
      // Turned on from another device in the meantime.
      if (response.status === 409) return 'already_enabled';
      return refusalOf(response);
    },
    onSuccess: (outcome) => {
      if (typeof outcome === 'object') onKey({ totpUri: outcome.totpUri, password });
      else if (outcome === 'already_enabled') onAlreadyOn();
    },
  });
  const outcome = start.isPending ? undefined : start.data;

  return (
    <>
      <p className="text-sm text-muted-foreground">{m.account_two_factor_off()}</p>
      <Form
        aria-labelledby={titleId}
        className="flex flex-col gap-4"
        validationErrors={
          outcome === 'wrong_password' ? { password: m.account_wrong_password() } : {}
        }
        onSubmit={(event) => {
          event.preventDefault();
          start.mutate();
        }}
      >
        <PasswordField
          label={m.account_current_password()}
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (start.data !== undefined) start.reset();
          }}
          groupClassName="max-md:h-auto"
          toggleClassName="max-md:size-11"
        />
        <Button type="submit" className="self-start max-md:min-h-11" isDisabled={start.isPending}>
          {m.account_two_factor_enable()}
        </Button>
        <ErrorMessage>
          {outcome === 'too_many_attempts' && m.account_too_many_attempts()}
          {(start.isError || outcome === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </>
  );
}

/** The key, as a QR code and as a text to copy, and the first code that proves the app has it. */
function ConfirmKey({
  titleId,
  totpUri,
  password,
  onConfirmed,
  onCancel,
}: {
  titleId: string;
  totpUri: string;
  password: string;
  onConfirmed: (backupCodes: string[]) => void;
  onCancel: () => void;
}) {
  const api = useApi();
  const [code, setCode] = useState('');
  const key = new URL(totpUri).searchParams.get('secret') ?? '';
  const confirm = useMutation({
    mutationFn: async (): Promise<{ backupCodes: string[] } | 'invalid_code' | Refusal> => {
      const response = await api.account['two-factor'].confirm.$post({
        json: { password, code },
      });
      if (response.status === 200) return response.json();
      if (response.status === 400) return 'invalid_code';
      return refusalOf(response);
    },
    onSuccess: (outcome) => {
      if (typeof outcome === 'object') onConfirmed(outcome.backupCodes);
    },
  });
  const outcome = confirm.isPending ? undefined : confirm.data;

  return (
    <>
      <p className="text-sm text-muted-foreground">{m.account_two_factor_scan()}</p>
      {/* Dark on white in both themes, with its quiet zone: it is what a camera reads. */}
      <figure
        aria-label={m.account_two_factor_qr()}
        className="self-start rounded-control bg-white p-3"
      >
        <QRCodeSVG value={totpUri} size={160} bgColor="#ffffff" fgColor="#000000" aria-hidden />
      </figure>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{m.account_two_factor_key()}</span>
        {/* In groups of four, as it is read out and typed; the copy is the key itself. */}
        <code className="font-mono text-sm break-all">{key.match(/.{1,4}/g)?.join(' ')}</code>
        <CopyButton text={key} label={m.account_two_factor_copy_key()} />
      </div>
      <Form
        aria-labelledby={titleId}
        className="flex flex-col gap-4"
        validationErrors={outcome === 'invalid_code' ? { code: m.auth_two_factor_invalid() } : {}}
        onSubmit={(event) => {
          event.preventDefault();
          confirm.mutate();
        }}
      >
        <CodeField
          label={m.account_two_factor_confirm_code()}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (confirm.data !== undefined) confirm.reset();
          }}
          digitsOnly
          inputClassName="max-md:h-11"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="max-md:min-h-11" isDisabled={confirm.isPending}>
            {m.account_two_factor_confirm()}
          </Button>
          <Button variant="outline" className="max-md:min-h-11" onPress={onCancel}>
            {m.cancel()}
          </Button>
        </div>
        <ErrorMessage>
          {/* Changed from another device since the key was asked for. */}
          {outcome === 'wrong_password' && m.account_wrong_password()}
          {outcome === 'too_many_attempts' && m.account_too_many_attempts()}
          {(confirm.isError || outcome === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </>
  );
}

/** On: how many backup codes are left; the password makes new ones, or turns the second factor off. */
function TurnedOn({
  titleId,
  backupCodesLeft,
  onBackupCodes,
  onTurnedOff,
}: {
  titleId: string;
  backupCodesLeft: number;
  onBackupCodes: (codes: string[]) => void;
  onTurnedOff: () => void;
}) {
  const api = useApi();
  const [password, setPassword] = useState('');
  const act = useMutation({
    mutationFn: async (
      action: 'regenerate' | 'disable',
    ): Promise<{ backupCodes: string[] } | 'turned_off' | Refusal> => {
      if (action === 'regenerate') {
        const response = await api.account['two-factor']['backup-codes'].$post({
          json: { password },
        });
        return response.status === 200 ? response.json() : refusalOf(response);
      }
      const response = await api.account['two-factor'].disable.$post({ json: { password } });
      // 409: turned off from another device in the meantime, which is what was asked for.
      return response.status === 204 || response.status === 409
        ? 'turned_off'
        : refusalOf(response);
    },
    onSuccess: (outcome) => {
      if (typeof outcome === 'object') onBackupCodes(outcome.backupCodes);
      else if (outcome === 'turned_off') onTurnedOff();
    },
  });
  const outcome = act.isPending ? undefined : act.data;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {m.account_two_factor_on()} {m.account_backup_codes_left({ count: backupCodesLeft })}
        {backupCodesLeft <= FEW_BACKUP_CODES && (
          <span className="block font-medium text-foreground">{m.account_backup_codes_low()}</span>
        )}
      </p>
      <Form
        aria-labelledby={titleId}
        className="flex flex-col gap-4"
        validationErrors={
          outcome === 'wrong_password' ? { password: m.account_wrong_password() } : {}
        }
        onSubmit={(event) => {
          event.preventDefault();
          // Two buttons, one password: the one pressed says what it is for.
          const submitter =
            event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null;
          act.mutate(
            submitter instanceof HTMLButtonElement && submitter.value === 'disable'
              ? 'disable'
              : 'regenerate',
          );
        }}
      >
        <PasswordField
          label={m.account_current_password()}
          value={password}
          onChange={(value) => {
            setPassword(value);
            if (act.data !== undefined) act.reset();
          }}
          groupClassName="max-md:h-auto"
          toggleClassName="max-md:size-11"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="action"
            value="regenerate"
            variant="outline"
            className="max-md:min-h-11"
            isDisabled={act.isPending}
          >
            {m.account_backup_codes_regenerate()}
          </Button>
          <Button
            type="submit"
            name="action"
            value="disable"
            variant="outline"
            className="max-md:min-h-11"
            isDisabled={act.isPending}
          >
            {m.account_two_factor_disable()}
          </Button>
        </div>
        <ErrorMessage>
          {outcome === 'too_many_attempts' && m.account_too_many_attempts()}
          {(act.isError || outcome === 'error') && m.auth_error()}
        </ErrorMessage>
      </Form>
    </>
  );
}
