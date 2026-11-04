/**
 * Fetches from AMO the signed file of a version already sent (spec extension §11): a re-run of the
 * `extension` job of `release.yml` downloads it rather than signing again, since AMO refuses a version
 * it already has.
 *
 * `node apps/extension/scripts/amo-signed-version.ts <gecko id> <version> <file.xpi>`, with
 * `WEB_EXT_API_KEY` and `WEB_EXT_API_SECRET` in the environment.
 * - exit 0: the signed file is written;
 * - exit 2: AMO does not have this version, which is to be signed;
 * - exit 1: anything else, the release stops. A version awaiting approval is waited for, 30 minutes
 *   at most, as `web-ext sign --approval-timeout` would.
 */
import { createHmac, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const AMO_API = 'https://addons.mozilla.org/api/v5';
const APPROVAL_TIMEOUT_MS = 30 * 60_000;
const POLL_MS = 30_000;
const NOT_FOUND = 2;

const [geckoId, version, output] = process.argv.slice(2);
const key = process.env['WEB_EXT_API_KEY'];
const secret = process.env['WEB_EXT_API_SECRET'];
if (!geckoId || !version || !output || !key || !secret) {
  console.error(
    'Usage: amo-signed-version.ts <gecko id> <version> <file.xpi>, with WEB_EXT_API_KEY and WEB_EXT_API_SECRET set.',
  );
  process.exit(1);
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

/** A fresh JWT for each request (AMO's API auth): HS256, a minute long, five at most. */
function authorization(): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({ iss: key, jti: randomUUID(), iat: issuedAt, exp: issuedAt + 60 }),
  );
  const signature = createHmac('sha256', secret ?? '')
    .update(`${header}.${claims}`)
    .digest('base64url');
  return `JWT ${header}.${claims}.${signature}`;
}

/** The file of a version, as AMO's API gives it: where to download it, and whether it is signed. */
function fileOf(amoVersion: unknown): { url: string; status: string } {
  const file: unknown =
    typeof amoVersion === 'object' && amoVersion !== null && 'file' in amoVersion
      ? amoVersion.file
      : null;
  if (
    typeof file === 'object' &&
    file !== null &&
    'url' in file &&
    typeof file.url === 'string' &&
    'status' in file &&
    typeof file.status === 'string'
  ) {
    return { url: file.url, status: file.status };
  }
  throw new Error(`AMO's version has no file: ${JSON.stringify(amoVersion)}`);
}

// The `v` makes AMO read a version number, never an id.
const versionUrl = `${AMO_API}/addons/addon/${encodeURIComponent(geckoId)}/versions/v${version}/`;
const deadline = Date.now() + APPROVAL_TIMEOUT_MS;

for (;;) {
  const response = await fetch(versionUrl, { headers: { Authorization: authorization() } });
  // Neither the add-on (first release) nor this version yet.
  if (response.status === 404) {
    console.log(`AMO does not have ${version} yet.`);
    process.exit(NOT_FOUND);
  }
  if (!response.ok) throw new Error(`AMO answered ${response.status} for ${versionUrl}`);
  const file = fileOf(await response.json());
  if (file.status === 'public') {
    const download = await fetch(file.url, { headers: { Authorization: authorization() } });
    if (!download.ok) throw new Error(`AMO answered ${download.status} for ${file.url}`);
    writeFileSync(output, Buffer.from(await download.arrayBuffer()));
    console.log(`Downloaded the signed ${version} from AMO.`);
    process.exit(0);
  }
  if (file.status !== 'unreviewed' || Date.now() > deadline) {
    throw new Error(`AMO holds ${version} with its file ${file.status}: not signed.`);
  }
  console.log(`${version} awaits AMO's approval…`);
  await sleep(POLL_MS);
}
