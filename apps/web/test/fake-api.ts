type Handler = (body: unknown) => Response;

/** What the API answers when a test says nothing else: a signed-in User without a second factor nor a Contact, sign-ups open. */
const defaults: Record<string, Handler> = {
  'GET /api/session': () => Response.json({ email: 'jane@example.com' }),
  'GET /api/config': () => Response.json({ signupsOpen: true }),
  'GET /api/account/two-factor': () => Response.json({ enabled: false }),
  'GET /api/summary': () => Response.json({ contacts: [], stages: [], organizations: [] }),
};

/** No session on this device. */
export const signedOut = {
  'GET /api/session': () => Response.json({ error: 'unauthenticated' }, { status: 401 }),
} satisfies Record<string, Handler>;

/** A `fetch` that answers as the API would, route by route, and keeps what the SPA sent. */
export function fakeApi(routes: Record<string, Handler> = {}) {
  const handlers = { ...defaults, ...routes };
  const requests: { route: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const route = `${request.method} ${new URL(request.url).pathname}`;
    let body: unknown;
    if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
      // A file joined: its form, field by field.
      body = Object.fromEntries(await request.formData());
    } else {
      // A POST may carry no body at all, as signing out does.
      const text = await request.text();
      body = text === '' ? undefined : JSON.parse(text);
    }
    requests.push({ route, body });
    return handlers[route]?.(body) ?? new Response(null, { status: 404 });
  };
  return { fetch, requests, sent: (route: string) => requests.filter((r) => r.route === route) };
}
