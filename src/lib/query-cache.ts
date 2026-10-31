import { useCallback, useEffect, useRef, useState } from 'react';

// "Last known data" per screen, kept in memory and in localStorage so a full
// page load can paint the previous result instantly instead of showing a
// loading state while the fresh data arrives. Saved data is only for that
// first paint: it never counts as fresh, so it is always re-fetched. Keys must
// include the business id so one business's data can never appear under
// another.
const store = new Map<string, unknown>();
const fetchedAt = new Map<string, number>();

const FRESH_MS = 30 * 1000;
// Bump the version when the shape of a cached value changes, so a new build
// ignores data saved by an older one.
const STORAGE_PREFIX = 'distro-query-cache:';
const STORAGE_VERSION = 'v1:';

function readSaved(key: string): unknown {
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + STORAGE_VERSION + key);
    return saved === null ? undefined : JSON.parse(saved);
  } catch {
    return undefined;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + STORAGE_VERSION + key, JSON.stringify(value));
  } catch {
    // Best-effort: storage can be full or unavailable.
  }
}

export function clearQueryCache(): void {
  store.clear();
  fetchedAt.clear();
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(STORAGE_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Best-effort.
  }
}

// Any database write makes every cached screen stale, so a screen never skips
// a reload right after a record changed. Reads (GET and get_* RPCs) and
// non-database requests such as signed photo URLs don't count.
function isDatabaseWrite(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method === 'GET' || method === 'HEAD') return false;
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  return url.includes('/rest/v1/') && !url.includes('/rest/v1/rpc/get_');
}

export const fetchWithInvalidation: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (isDatabaseWrite(input, init)) fetchedAt.clear();
  return response;
};

// True when a screen loaded this key moments ago and nothing has been written
// since, so returning to it needn't hit the network. Pull-to-refresh and
// Refresh buttons bypass this by calling their load function directly.
export function isFresh(key: string | null): boolean {
  if (key === null) return false;
  const loadedAt = fetchedAt.get(key);
  return loadedAt !== undefined && Date.now() - loadedAt < FRESH_MS;
}

export function useCachedState<T>(key: string | null, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() =>
    key !== null && store.has(key) ? (store.get(key) as T) : initial
  );

  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    setValue(key !== null && store.has(key) ? (store.get(key) as T) : initial);
    // `initial` is only a fallback for a key with no cached value yet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // After mount, not in the useState initializer: the server render has no
  // saved data, and the first client render must match it.
  useEffect(() => {
    if (key === null || store.has(key)) return;
    const saved = readSaved(key);
    if (saved === undefined) return;
    store.set(key, saved);
    setValue(saved as T);
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (key !== null) {
        store.set(key, next);
        fetchedAt.set(key, Date.now());
        save(key, next);
      }
    },
    [key]
  );

  return [value, set];
}
