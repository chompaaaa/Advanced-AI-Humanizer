"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const neverChanges = () => () => {};

/**
 * False during SSR and the hydration render, true afterwards.
 *
 * Going through useSyncExternalStore rather than a mount effect keeps the
 * server and client renders identical, so there is no hydration mismatch and
 * no setState inside an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}

function subscribeToStorage(onChange: () => void): () => void {
  // Fires for writes made by other tabs. Same-tab writes go through
  // writeStoredValue, whose caller already owns the value in React state.
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * Reads a value out of localStorage as an external store.
 *
 * The raw snapshot is a string (or null), which compares by value, so React
 * only re-renders when the stored text actually changes. Returns `fallback`
 * on the server, when storage is unavailable, and when parsing fails.
 */
export function useStoredValue<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T,
): T {
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      // Private-mode Safari and blocked-cookie setups both throw here.
      return null;
    }
  }, [key]);

  const raw = useSyncExternalStore(subscribeToStorage, getSnapshot, () => null);

  return useMemo(() => {
    if (raw === null) return fallback;
    try {
      return parse(raw);
    } catch {
      return fallback;
    }
    // `parse` and `fallback` are stable per call site by construction; keying
    // off the raw string alone keeps the returned object identity stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
}

/** Best-effort write. Never throws into the render path. */
export function writeStoredValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — the app works fine without persistence.
  }
}
