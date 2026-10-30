import { m } from '@battlecrm/i18n';
import { Button, buttonVariants, Checkbox } from '@battlecrm/ui';
import { useId, useState } from 'react';

import { CopyButton } from './copy-button.tsx';

/**
 * The backup codes, shown once: when the second factor is turned on, and each time they are made anew
 * (spec UX §5.9). The User copies or downloads them and says they are safe before the panel closes.
 */
export function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const titleId = useId();
  const [saved, setSaved] = useState(false);
  const text = `${codes.join('\n')}\n`;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h4 id={titleId} className="text-sm font-medium">
        {m.account_backup_codes_title()}
      </h4>
      <p className="text-sm text-muted-foreground">{m.account_backup_codes_body()}</p>
      <ul
        aria-labelledby={titleId}
        className="grid grid-cols-2 gap-x-6 gap-y-1 self-start font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <CopyButton text={text} />
        {/* A file made here, of what is already on the page: no request, so offline too. */}
        <a
          className={buttonVariants({ variant: 'outline', className: 'max-md:min-h-11' })}
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download="battlecrm-backup-codes.txt"
        >
          {m.download()}
        </a>
      </div>
      <Checkbox className="max-md:min-h-11" isSelected={saved} onChange={setSaved}>
        {m.account_backup_codes_saved()}
      </Checkbox>
      <Button className="self-start max-md:min-h-11" isDisabled={!saved} onPress={onDone}>
        {m.done()}
      </Button>
    </section>
  );
}
