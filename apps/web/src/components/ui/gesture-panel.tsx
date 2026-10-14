import { m } from '@battlecrm/i18n';
import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Dialog, Heading, Modal } from 'react-aria-components';

import { Button } from './button.tsx';
import { DialogOverlay } from './dialog.tsx';

/**
 * The panel of a gesture (spec UX §6): modal, the focus trapped then given back to what opened it,
 * `Escape` closes. On mobile, a full-screen sheet with ✕ at the top; its content is a
 * `GesturePanelBody` that scrolls, then a `GesturePanelFooter` stuck at the bottom.
 */
export function GesturePanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <DialogOverlay
      isOpen
      isDismissable
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal
        data-slot="dialog-content"
        className="fixed inset-0 z-50 flex flex-col bg-background text-sm text-foreground ring-1 ring-border focus-ring duration-100 data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 motion-reduce:animate-none md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-2rem)] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card"
      >
        <Dialog className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="flex items-start justify-between gap-2 p-4 pb-0">
            <Heading slot="title" className="text-base leading-snug font-medium">
              {title}
            </Heading>
            <Button
              slot="close"
              variant="ghost"
              size="icon-sm"
              className="-mt-1 -mr-1 max-md:size-11"
              aria-label={m.close()}
            >
              <XIcon />
            </Button>
          </div>
          {children}
        </Dialog>
      </Modal>
    </DialogOverlay>
  );
}

/** What a gesture asks and shows; it scrolls under a footer that stays. */
export function GesturePanelBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4', className)}>
      {children}
    </div>
  );
}

/** Where the gesture is validated: at the bottom of the sheet on mobile. */
export function GesturePanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t bg-surface p-4 md:flex-row md:justify-end md:rounded-b-card">
      {children}
    </div>
  );
}
