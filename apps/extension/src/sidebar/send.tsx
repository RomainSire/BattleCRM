import { createContext, use } from 'react';

import type { Send } from '../messages.ts';

/** How the sidebar asks the background: `send()`, or a fake background in the tests. */
export const SendContext = createContext<Send | null>(null);

export function useSend(): Send {
  const send = use(SendContext);
  if (send === null) throw new Error('useSend needs a SendContext');
  return send;
}
