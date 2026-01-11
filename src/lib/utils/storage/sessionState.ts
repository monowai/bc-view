/**
 * Browser session state utility for micro-frontend compatible state management.
 *
 * Uses sessionStorage for persistence within a browser session and custom events
 * for real-time synchronization across tabs and micro-frontends.
 *
 * Features:
 * - Persists state to sessionStorage (survives page refresh, clears on browser close)
 * - Fires custom events for real-time sync across micro-frontends
 * - SSR-safe (no-op on server)
 */

/** Storage key prefix for all BeanCounter session state */
export const BC_STORAGE_PREFIX = "bc:"

/** Event name prefix for cross-tab/micro-frontend sync */
export const BC_EVENT_PREFIX = "bc:storage:"

/**
 * Get a value from session storage
 */
export function getSessionValue<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") {
    return defaultValue
  }
  try {
    const stored = sessionStorage.getItem(`${BC_STORAGE_PREFIX}${key}`)
    if (stored !== null) {
      return JSON.parse(stored) as T
    }
  } catch {
    // Ignore parse errors
  }
  return defaultValue
}

/**
 * Set a value in session storage and dispatch a custom event for sync
 */
export function setSessionValue<T>(key: string, value: T): void {
  if (typeof window === "undefined") return

  const storageKey = `${BC_STORAGE_PREFIX}${key}`
  const eventName = `${BC_EVENT_PREFIX}${key}`

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(value))
    // Dispatch custom event for cross-component/micro-frontend sync
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: { key, value },
      }),
    )
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Subscribe to changes for a specific key.
 * Returns an unsubscribe function.
 */
export function subscribeToSessionValue(
  key: string,
  callback: (value: unknown) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const eventName = `${BC_EVENT_PREFIX}${key}`

  const handler = (event: Event): void => {
    const customEvent = event as CustomEvent<{ key: string; value: unknown }>
    callback(customEvent.detail.value)
  }

  window.addEventListener(eventName, handler)

  // Also listen for storage events from other tabs
  const storageHandler = (event: StorageEvent): void => {
    if (event.key === `${BC_STORAGE_PREFIX}${key}` && event.newValue) {
      try {
        callback(JSON.parse(event.newValue))
      } catch {
        // Ignore parse errors
      }
    }
  }

  window.addEventListener("storage", storageHandler)

  return () => {
    window.removeEventListener(eventName, handler)
    window.removeEventListener("storage", storageHandler)
  }
}

/**
 * Create a typed session state manager for a specific key.
 * Provides get, set, and subscribe methods.
 */
interface SessionState<T> {
  get: () => T
  set: (value: T) => void
  subscribe: (callback: (value: T) => void) => () => void
}

export function createSessionState<T>(
  key: string,
  defaultValue: T,
): SessionState<T> {
  return {
    get: (): T => getSessionValue(key, defaultValue),
    set: (value: T): void => setSessionValue(key, value),
    subscribe: (callback: (value: T) => void): (() => void) =>
      subscribeToSessionValue(key, callback as (value: unknown) => void),
  }
}
