/** One answer of the fake API, given the request the background sent. */
type Handler = (request: Request) => Response | Promise<Response>;

/**
 * The API as the background meets it, at the level of `fetch`: each `'METHOD /path'` answers with its
 * handler, anything else with a 404; `last()` gives back a request sent, with the `init` it came with.
 * `down()` makes it unreachable, as without a network.
 */
export function fakeApi(handlers: Record<string, Handler> = {}) {
  const requests: { request: Request; init: RequestInit | undefined }[] = [];
  let reachable = true;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (!reachable) throw new TypeError('NetworkError when attempting to fetch resource.');
    const request = new Request(input, init);
    requests.push({ request, init });
    const handler = handlers[`${request.method} ${new URL(request.url).pathname}`];
    return handler ? handler(request) : Response.json({ error: 'not_found' }, { status: 404 });
  };
  return {
    fetch,
    /** The last request sent to `'METHOD /path'`. */
    last(route: string) {
      return requests.findLast(
        ({ request }) => `${request.method} ${new URL(request.url).pathname}` === route,
      );
    },
    down() {
      reachable = false;
    },
  };
}
