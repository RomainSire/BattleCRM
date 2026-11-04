import { render } from 'vitest-browser-react';

import type { AnswerTo, Message, Send } from '../src/messages.ts';
import type { WatchActiveTab } from '../src/sidebar/active-tab.ts';
import { Sidebar } from '../src/sidebar/sidebar.tsx';

export const APP_ORIGIN = 'https://app.battlecrm.test';

type Answers = {
  [T in Message['type']]?: (
    message: Extract<Message, { type: T }>,
  ) => AnswerTo<Extract<Message, { type: T }>> | Promise<AnswerTo<Extract<Message, { type: T }>>>;
};

/**
 * A fake background at the level of `send()` (spec extension §10): each type of message answers with
 * its handler; every message sent is kept. Signed out by default.
 */
export function fakeBackground(answers: Answers = {}) {
  const messages: Message[] = [];
  const handlers: Answers = {
    session: () => ({ status: 'signedOut' }),
    signOut: () => null,
    ...answers,
  };
  const send: Send = async (message) => {
    messages.push(message);
    // The handler of a type answers its own messages: TypeScript cannot pair them through the index.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const handler = handlers[message.type] as ((sent: typeof message) => never) | undefined;
    if (handler === undefined) throw new Error(`No fake answer to ${message.type}`);
    return handler(message);
  };
  return {
    send,
    messages,
    /** Changes what a type of message answers from now on. */
    answer<T extends Message['type']>(type: T, handler: NonNullable<Answers[T]>) {
      handlers[type] = handler as Answers[T];
    },
  };
}

/**
 * The active tab of the sidebar's window, played by the test: its address at first, then each one
 * `go()` moves it to. `undefined`, an address the extension may not read (another site).
 */
export function fakeTab(url?: string) {
  let current = url;
  const listeners = new Set<(url: string | undefined) => void>();
  const watch: WatchActiveTab = (onAddress) => {
    listeners.add(onAddress);
    onAddress(current);
    return () => listeners.delete(onAddress);
  };
  return {
    watch,
    go(address: string | undefined) {
      current = address;
      for (const listener of listeners) listener(address);
    },
  };
}

/** The sidebar as Firefox opens it, against a fake background, beside a tab off LinkedIn by default. */
export async function renderSidebar(background = fakeBackground(), tab = fakeTab()) {
  const screen = await render(
    <Sidebar send={background.send} appOrigin={APP_ORIGIN} watchActiveTab={tab.watch} />,
  );
  return { screen, background, tab };
}
