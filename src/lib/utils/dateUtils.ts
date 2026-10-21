import { localIsoDate, todayIso } from "@lib/formatters"

/** Resolves the "today" sentinel to the local date; any other value passes through. */
export const getTodayDate = (date: string): string =>
  date === "today" ? todayIso() : date

/**
 * A local YYYY-MM-DD date offset from today by whole days.
 * e.g. getDateOffset(-1) = yesterday (t-1), getDateOffset(1) = tomorrow (t+1).
 */
export const getDateOffset = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localIsoDate(d)
}
