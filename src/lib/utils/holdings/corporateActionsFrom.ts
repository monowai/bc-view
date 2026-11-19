import { CorporateEvent, DateValues } from "types/beancounter"

type HoldingDates = Pick<DateValues, "opened" | "firstTransaction">

/**
 * The date a holding's splits, and every event but a dividend, can be owed from.
 *
 * `opened` follows an imported holding's cost date, which can be years before
 * it was first traded in Beancounter; no split before that trade applies to
 * it, as the statement's quantity is already after them. `firstTransaction`
 * never resets, so a holding re-bought after selling out is owed nothing
 * before it re-opened. The later of the two covers both.
 */
export function corporateActionsFrom(
  dateValues?: HoldingDates,
): string | undefined {
  const dates = [dateValues?.opened, dateValues?.firstTransaction].filter(
    (date): date is string => !!date,
  )
  return dates.sort().at(-1)
}

/**
 * The date a holding's dividends can be owed from: when it opened. An imported
 * holding opens on its cost date, and is owed dividends from then.
 */
export function dividendsFrom(dateValues?: HoldingDates): string | undefined {
  return dateValues?.opened || corporateActionsFrom(dateValues)
}

/**
 * Whether an event can be owed to a holding first traded on `splitsFrom`
 * (see {@link corporateActionsFrom}). A dividend can be recorded before then,
 * back to {@link dividendsFrom}; a split or any other event cannot.
 */
export function isOwedFrom(
  event: Pick<CorporateEvent, "trnType" | "recordDate">,
  splitsFrom?: string,
): boolean {
  return (
    event.trnType === "DIVI" || !splitsFrom || event.recordDate >= splitsFrom
  )
}
