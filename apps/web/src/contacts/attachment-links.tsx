import { m } from '@battlecrm/i18n';
import { Paperclip } from 'lucide-react';

import { useApi } from '../session.ts';
import type { SummaryPositioning } from '../summary.ts';

/** The attachments of a Positioning, each a link that downloads it (spec UX §6.1, §6.3). */
export function AttachmentLinks({
  attachments,
}: {
  attachments: SummaryPositioning['attachments'];
}) {
  const api = useApi();
  if (attachments.length === 0) return null;
  return (
    <ul aria-label={m.send_attachments()} className="flex flex-col gap-1">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <a
            href={api.attachments[':id'].$url({ param: { id: attachment.id } }).href}
            download={attachment.name}
            className="inline-flex items-center gap-1.5 rounded-control text-accent-text underline-offset-4 focus-ring hover:underline"
          >
            <Paperclip aria-hidden className="size-3.5" />
            {attachment.name}
          </a>
        </li>
      ))}
    </ul>
  );
}
