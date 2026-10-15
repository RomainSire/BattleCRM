import { ATTACHMENT_MAX_BYTES } from '@battlecrm/contract';
import { m } from '@battlecrm/i18n';
import { useMutation } from '@tanstack/react-query';
import { Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { FileTrigger } from 'react-aria-components';

import { Button } from '../components/ui/button.tsx';
import { ErrorMessage } from '../components/ui/error-message.tsx';
import { useSendGesture, type RefusalOf } from '../gesture.ts';
import { useLocale } from '../i18n.ts';
import { useApi, type ApiClient } from '../session.ts';
import { attachmentsOf, isFrozen, type SummaryPositioning } from '../summary.ts';

type Attachment = SummaryPositioning['attachments'][number];

/** A size as a person reads it: in kB under a megabyte, in MB above. */
function sizeOf(bytes: number, locale: string) {
  const megabyte = 1024 * 1024;
  const [value, unit] =
    bytes < megabyte ? [bytes / 1024, 'kilobyte'] : [bytes / megabyte, 'megabyte'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, maximumFractionDigits: 1 }).format(
    value,
  );
}

/** What joining or removing an attachment may be refused with. */
type AttachmentRefusal =
  | RefusalOf<ApiClient['positionings'][':id']['attachments']['$post']>
  | RefusalOf<ApiClient['attachments'][':id']['remove']['$post']>;

/**
 * What a refusal tells the User, the name of the file it is about where it has one: anything but a
 * file too large or no room left, a Positioning changed elsewhere.
 */
function refusalText(refused: AttachmentRefusal | undefined, name: string) {
  if (refused === undefined) return undefined;
  if (refused.error === 'too_large') return m.positioning_attachment_too_large({ name });
  if (refused.error === 'quota_exceeded') return m.positioning_attachment_quota_exceeded();
  return m.positioning_behind();
}

/**
 * The attachments of a Positioning, in its record (ST-35): each downloaded by its name; joined and
 * removed with “Undo” as long as it is not frozen. A term and its description, inside the record's list.
 */
export function PositioningAttachments({ positioning }: { positioning: SummaryPositioning }) {
  const locale = useLocale();
  const api = useApi();
  const sendGesture = useSendGesture();
  const attachments = attachmentsOf(positioning);
  const frozen = isFrozen(positioning);
  /** The file refused before it was sent: over 5 MiB, no need to ask the server. */
  const [tooLarge, setTooLarge] = useState<string>();
  const attach = useMutation({
    mutationFn: (file: File) =>
      sendGesture(
        api.positionings[':id'].attachments.$post({
          param: { id: positioning.id },
          form: { file },
        }),
        () => m.positioning_attachment_added_toast({ name: file.name }),
      ),
  });
  const remove = useMutation({
    mutationFn: (attachment: Attachment) =>
      sendGesture(api.attachments[':id'].remove.$post({ param: { id: attachment.id } }), () =>
        m.positioning_attachment_removed_toast({ name: attachment.name }),
      ),
  });
  const choose = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    remove.reset();
    if (file.size > ATTACHMENT_MAX_BYTES) {
      attach.reset();
      setTooLarge(file.name);
      return;
    }
    setTooLarge(undefined);
    attach.mutate(file);
  };
  const failed = attach.isError || remove.isError;

  return (
    <>
      <dt className="text-muted-foreground">{m.positioning_attachments()}</dt>
      <dd className="flex flex-col items-start gap-2">
        {attachments.length === 0 ? (
          <span className="text-muted-foreground">{m.positioning_no_attachments()}</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-2">
                <Paperclip aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                <a
                  href={api.attachments[':id'].$url({ param: { id: attachment.id } }).href}
                  download={attachment.name}
                  className="break-all text-accent-text underline focus-ring"
                >
                  {attachment.name}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {sizeOf(attachment.size, locale)}
                </span>
                {!frozen && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="max-md:size-11"
                    aria-label={m.positioning_remove_attachment({ name: attachment.name })}
                    isDisabled={remove.isPending}
                    onPress={() => {
                      attach.reset();
                      setTooLarge(undefined);
                      remove.mutate(attachment);
                    }}
                  >
                    <X />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!frozen && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FileTrigger onSelect={choose}>
              <Button
                variant="outline"
                size="sm"
                className="max-md:min-h-11"
                isDisabled={attach.isPending}
              >
                <Paperclip aria-hidden />
                {m.positioning_attach()}
              </Button>
            </FileTrigger>
            <span className="text-xs text-muted-foreground">
              {m.positioning_attachments_hint()}
            </span>
          </div>
        )}
        <ErrorMessage>
          {failed
            ? m.auth_error()
            : (tooLarge !== undefined && m.positioning_attachment_too_large({ name: tooLarge })) ||
              refusalText(attach.data, attach.variables?.name ?? '') ||
              refusalText(remove.data, remove.variables?.name ?? '')}
        </ErrorMessage>
      </dd>
    </>
  );
}
