import { m } from '@battlecrm/i18n';
import { Button, ErrorMessage } from '@battlecrm/ui';
import { useState } from 'react';

/** Copies a text to the clipboard (ST-60) and says so; works offline, the text being already here. */
export function CopyButton({ text, label = m.copy() }: { text: string; label?: string }) {
  // `false` when the browser refused: the text stays on the page, to be selected by hand.
  const [copied, setCopied] = useState<boolean>();
  return (
    <>
      <Button
        variant="outline"
        className="max-md:min-h-11"
        onPress={async () => {
          setCopied(
            await navigator.clipboard.writeText(text).then(
              () => true,
              () => false,
            ),
          );
        }}
      >
        {label}
      </Button>
      {/* Always there, so that a screen reader announces what appears in it. */}
      <output className="text-sm text-muted-foreground empty:sr-only">
        {copied === true && m.copied()}
      </output>
      <ErrorMessage>{copied === false && m.auth_error()}</ErrorMessage>
    </>
  );
}
