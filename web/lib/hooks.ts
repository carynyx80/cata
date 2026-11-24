"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** true after hydration (no setState-in-effect). */
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);
/** Read something from `window.location` once on the client; `fallback` during SSR. */
export function useLocation<T>(read: (l: Location) => T, fallback: T): T {
  return useSyncExternalStore(noop, () => read(window.location), () => fallback);
}
