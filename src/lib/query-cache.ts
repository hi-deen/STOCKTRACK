import { useCallback, useEffect, useRef, useState } from 'react';

// In-memory "last known data" per screen. Screens still re-fetch on every
// focus; the cache only lets them paint the previous result instantly instead
// of showing a loading state while the fresh data arrives. Keys must include
// the business id so one business's data can never appear under another.
const store = new Map<string, unknown>();

export function clearQueryCache(): void {
  store.clear();
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

  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (key !== null) store.set(key, next);
    },
    [key]
  );

  return [value, set];
}
