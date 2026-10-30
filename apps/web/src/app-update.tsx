import { m } from '@battlecrm/i18n';
import { Button } from '@battlecrm/ui';
import { cn } from 'cn';
import { RefreshCw } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { useLocale } from './i18n.ts';

/** The version of this build: what the `X-App-Version` of the API is compared with. */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** The service worker once registered: how to look for a new version, and how to take it. */
type ServiceWorkerHandle = {
  lookForUpdate: () => Promise<unknown>;
  takeUpdate: () => Promise<unknown>;
};

/**
 * A new version (spec stack §3): an API of another version makes the service worker look for it, once;
 * when it is ready, the app offers to reload, and never reloads by itself.
 */
class AppUpdate {
  #worker: ServiceWorkerHandle | undefined;
  /** A version of the API other than this one, and the last one looked for. */
  #heard: string | undefined;
  #lookedFor: string | undefined;
  #isAvailable = false;
  readonly #listeners = new Set<() => void>();

  /** The service worker is registered. */
  registered(worker: ServiceWorkerHandle): void {
    this.#worker = worker;
    this.#lookForUpdate();
  }

  /** The API answered as `version` of the app. */
  heard(version: string | null): void {
    if (version === null || version === APP_VERSION) return;
    this.#heard = version;
    this.#lookForUpdate();
  }

  /** The new version is ready: the service worker waits for the User. */
  available(): void {
    this.#isAvailable = true;
    for (const listener of this.#listeners) listener();
  }

  /** Reloads on the new version, as the User asked. */
  take(): void {
    void this.#worker?.takeUpdate();
  }

  /** Forgets everything: for a test. */
  clear(): void {
    this.#worker = undefined;
    this.#heard = undefined;
    this.#lookedFor = undefined;
    this.#isAvailable = false;
    for (const listener of this.#listeners) listener();
  }

  readonly subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly isAvailable = () => this.#isAvailable;

  #lookForUpdate() {
    if (this.#worker === undefined || this.#heard === undefined) return;
    if (this.#heard === this.#lookedFor) return;
    this.#lookedFor = this.#heard;
    // Not found, or the network failed: the browser looks again on its own, at the next start.
    this.#worker.lookForUpdate().catch(() => undefined);
  }
}

export const appUpdate = new AppUpdate();

/** “New version available, reload”, until the User reloads: never forced (spec stack §3). */
export function AppUpdateNotice({ className }: { className?: string }) {
  useLocale();
  const isAvailable = useSyncExternalStore(appUpdate.subscribe, appUpdate.isAvailable);
  return (
    // An `output`: a status region, which announces the offer as it shows.
    <output className={cn(isAvailable ? 'block' : 'hidden', className)}>
      {isAvailable && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <RefreshCw aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <span>{m.app_update_available()}</span>
          <Button
            variant="outline"
            size="sm"
            className="max-md:min-h-11"
            onPress={() => appUpdate.take()}
          >
            {m.app_update_reload()}
          </Button>
        </p>
      )}
    </output>
  );
}
