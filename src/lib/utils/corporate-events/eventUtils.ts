import { CorporateEvent, Position, Transaction } from "types/beancounter"

/**
 * Number of days added to record date to calculate effective pay date for dividends.
 * Dividends typically pay ~18 days after the record date.
 */
const DIVIDEND_PAY_DATE_OFFSET_DAYS = 18

/**
 * Number of days (±) around the pay date to use for fuzzy transaction matching.
 * Transactions may settle before or after the actual pay date.
 */
const TRANSACTION_MATCH_WINDOW_DAYS = 20

/**
 * Calculate effective pay date for dividends.
 * For dividends, this is recordDate + 18 days.
 * For other event types (splits), returns the payDate as-is.
 */
export const calculateEffectivePayDate = (event: CorporateEvent): string => {
  if (event.trnType !== "DIVI") {
    return event.payDate
  }
  const recordDate = new Date(event.recordDate)
  recordDate.setDate(recordDate.getDate() + DIVIDEND_PAY_DATE_OFFSET_DAYS)
  return recordDate.toISOString().split("T")[0]
}

/**
 * Check if an event can be processed based on its effective pay date.
 * Dividends can only be processed if their effective pay date has passed.
 * Splits can always be processed immediately.
 */
export const canProcessEvent = (
  event: CorporateEvent,
  referenceDate: string,
): boolean => {
  if (event.trnType !== "DIVI") {
    return true // Splits can always be processed
  }
  const effectivePayDate = calculateEffectivePayDate(event)
  return effectivePayDate <= referenceDate
}

/**
 * Find the matching transaction for a corporate event in the portfolio.
 *
 * Matching strategy:
 * 1. Exact match: transaction.callerRef.batch === event.id (definite match)
 * 2. Fuzzy match: transaction date within ±20 days of event pay date
 *
 * Both conditions also require matching transaction types.
 *
 * @returns The matching transaction, or undefined if none found
 */
export const getMatchingTransaction = (
  event: CorporateEvent,
  portfolioTransactions: Transaction[],
): Transaction | undefined => {
  return portfolioTransactions.find((trn) => {
    // Must match transaction type
    if (trn.trnType !== event.trnType) return false

    // Definite match: callerRef.batch contains the event.id
    if (trn.callerRef?.batch === event.id) return true

    // Fuzzy match: transaction date within ±20 days of pay date
    // Use payDate for matching since transactions settle around that time
    const payDate = new Date(event.payDate)
    const windowStart = new Date(payDate)
    windowStart.setDate(windowStart.getDate() - TRANSACTION_MATCH_WINDOW_DAYS)
    const windowEnd = new Date(payDate)
    windowEnd.setDate(windowEnd.getDate() + TRANSACTION_MATCH_WINDOW_DAYS)
    const trnDate = new Date(trn.tradeDate)
    return trnDate >= windowStart && trnDate <= windowEnd
  })
}

/**
 * Check if a corporate event has a matching transaction in the portfolio.
 *
 * Matching strategy:
 * 1. Exact match: transaction.callerRef.batch === event.id (definite match)
 * 2. Fuzzy match: transaction date within ±20 days of event pay date
 *
 * Both conditions also require matching transaction types.
 */
export const isEventReconciled = (
  event: CorporateEvent,
  portfolioTransactions: Transaction[],
): boolean => {
  return getMatchingTransaction(event, portfolioTransactions) !== undefined
}

/**
 * Check if a position was closed before the corporate event record date.
 * If the position was closed before the record date, the event doesn't apply
 * because the investor didn't hold shares on the record date.
 *
 * @param closedDate - The date the position was closed (undefined if still open)
 * @param event - The corporate event to check against
 * @returns true if position was closed before the event's record date
 */
export const isClosedBeforeEvent = (
  closedDate: string | undefined,
  event: CorporateEvent,
): boolean => {
  if (!closedDate) return false // Position still open
  return closedDate < event.recordDate
}

/**
 * Check if a position was closed before the corporate event record date.
 * Convenience overload that extracts closedDate from a Position object.
 *
 * @param position - The position to check
 * @param event - The corporate event to check against
 * @returns true if position was closed before the event's record date
 */
export const isPositionClosedBeforeEvent = (
  position: Position,
  event: CorporateEvent,
): boolean => {
  return isClosedBeforeEvent(position.dateValues?.closed, event)
}

/**
 * Sort corporate events by record date in descending order (most recent first).
 */
export const sortEventsByRecordDateDesc = (
  events: CorporateEvent[],
): CorporateEvent[] => {
  return [...events].sort(
    (a, b) =>
      new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime(),
  )
}

/**
 * Filter events to only include those that are:
 * 1. Not for closed positions (if closedDate provided)
 * 2. Not already reconciled with existing transactions
 * 3. Ready to be processed (effective pay date has passed)
 */
export const getMissingProcessableEvents = (
  events: CorporateEvent[],
  portfolioTransactions: Transaction[],
  referenceDate: string,
  closedDate?: string,
): CorporateEvent[] => {
  return events.filter(
    (event) =>
      !isClosedBeforeEvent(closedDate, event) &&
      !isEventReconciled(event, portfolioTransactions) &&
      canProcessEvent(event, referenceDate),
  )
}

/**
 * Filter events to exclude those for closed positions.
 * Used for display purposes to hide irrelevant events.
 */
export const filterEventsForOpenPosition = (
  events: CorporateEvent[],
  closedDate?: string,
): CorporateEvent[] => {
  return events.filter((event) => !isClosedBeforeEvent(closedDate, event))
}
