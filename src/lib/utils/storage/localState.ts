/**
 * Browser local-storage helpers — survive browser restart.
 *
 * Mirror of `sessionState.ts` (same `bc:` prefix), backed by `localStorage`
 * instead of `sessionStorage`. SSR-safe (no-op on server). No event bus —
 * persistent caches like recent-searches don't need cross-component sync.
 */

import { BC_STORAGE_PREFIX } from "./sessionState"

export function getLocalValue<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue
  try {
    const stored = window.localStorage.getItem(`${BC_STORAGE_PREFIX}${key}`)
    if (stored !== null) {
      return JSON.parse(stored) as T
    }
  } catch {
    // Ignore parse errors
  }
  return defaultValue
}

export function setLocalValue<T>(key: string, value: T): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      `${BC_STORAGE_PREFIX}${key}`,
      JSON.stringify(value),
    )
  } catch {
    // Ignore quota errors
  }
}
