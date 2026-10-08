/**
 * localStorage helpers for the guest-side storefront state (cart, wishlist).
 *
 * The values live in an external store rather than in component state, which is
 * what keeps them hydration safe: `useSyncExternalStore` renders the server
 * snapshot (empty) while hydrating and switches to the real stored value
 * immediately afterwards. Nothing has to be read in an effect, and the first
 * render on the client can never disagree with the server HTML.
 *
 * Everything is wrapped: Safari in private mode, disabled storage and corrupted
 * values must never break the page, they only mean "no saved state".
 */

function readStoredValue<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return undefined;

    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Serialises a value, silently doing nothing when storage is unavailable. */
function writeStoredValue(key: string, value: unknown): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled: the session still works in memory.
  }
}

export type StoredValue<T> = {
  subscribe: (listener: () => void) => () => void;
  /** Client snapshot: reads storage once, then serves the cached value. */
  getSnapshot: () => T;
  /** Server snapshot: the empty starting value, so hydration always matches. */
  getServerSnapshot: () => T;
  /** False on the server, true once the stored value has been read. */
  isHydrated: () => boolean;
  isHydratedServerSnapshot: () => boolean;
  /** Writes through to localStorage and notifies every subscriber. */
  set: (value: T) => void;
};

/**
 * A single JSON value mirrored into localStorage.
 *
 * `isValid` is what keeps stale or hand-edited data from reaching the UI: when
 * it rejects the parsed value (or the value is not JSON at all) the store falls
 * back to `createInitial()`.
 */
export function createStoredValue<T>({
  key,
  createInitial,
  isValid,
}: {
  key: string;
  createInitial: () => T;
  isValid: (value: unknown) => value is T;
}): StoredValue<T> {
  const initial = createInitial();
  const listeners = new Set<() => void>();

  let cache = initial;
  let loaded = false;

  const load = () => {
    if (loaded) return;
    loaded = true;

    const stored = readStoredValue(key, isValid);
    if (stored !== undefined) cache = stored;
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot() {
      load();
      return cache;
    },
    getServerSnapshot() {
      return initial;
    },
    isHydrated() {
      load();
      return true;
    },
    isHydratedServerSnapshot() {
      return false;
    },
    set(value) {
      cache = value;
      writeStoredValue(key, value);
      for (const listener of listeners) listener();
    },
  };
}