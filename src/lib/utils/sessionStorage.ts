// Get today's date in YYYY-MM-DD format (local timezone)
export const getToday = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Get a date offset from today (in whole days) in YYYY-MM-DD format.
// e.g. getDateOffset(-1) = yesterday (t-1), getDateOffset(1) = tomorrow (t+1).
export const getDateOffset = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Helper to safely get from sessionStorage (handles SSR)
export const getSessionValue = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue
  const stored = sessionStorage.getItem(key)
  if (stored === null) return defaultValue
  try {
    return JSON.parse(stored) as T
  } catch {
    return defaultValue
  }
}

// Helper to safely set sessionStorage
export const setSessionValue = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return
  sessionStorage.setItem(key, JSON.stringify(value))
}
