import { DateValues } from "types/beancounter"

/**
 * The date a holding's dividends and splits can be owed from.
 *
 * `opened` follows an imported holding's cost date, which can be years before
 * it was first traded in Beancounter; nothing before that trade applies to
 * it. `firstTransaction` never resets, so a holding re-bought after selling out
 * is owed nothing before it re-opened. The later of the two covers both.
 */
export function corporateActionsFrom(
  dateValues?: Pick<DateValues, "opened" | "firstTransaction">,
): string | undefined {
  const dates = [dateValues?.opened, dateValues?.firstTransaction].filter(
    (date): date is string => !!date,
  )
  return dates.sort().at(-1)
}
