import { Transaction } from "types/beancounter"
import { isAutoSettleLeg } from "@lib/trns/tradeUtils"

/** A ladder row's place in a trade + auto-settle leg pair. */
export interface LadderPair {
  /** The trade the pair is named for. */
  trade: Transaction
  /** Which end of the pair this row is, in ladder order. */
  edge: "top" | "bottom"
  /** The two rows sit next to each other, so a bracket can join them. */
  adjacent: boolean
}

/** Where each trade sits on the ladder, by the callerId its legs carry as batch. */
function tradesByCallerId(trns: Transaction[]): Map<string, number> {
  const at = new Map<string, number>()
  trns.forEach((trn, i) => {
    const callerId = trn.callerRef?.callerId
    if (callerId && !isAutoSettleLeg(trn)) at.set(callerId, i)
  })
  return at
}

/**
 * Pairs each auto-settle leg with the trade it settles, where both are on the
 * ladder: the leg's batch is the trade's callerId. Keyed by row id, both rows
 * of a pair present. A leg whose trade lives in another portfolio (the funding
 * side) stays unpaired.
 */
export function pairAutoSettleRows(
  trns: Transaction[],
): Map<string, LadderPair> {
  const tradeAt = tradesByCallerId(trns)
  const pairs = new Map<string, LadderPair>()
  trns.forEach((leg, legAt) => {
    if (!isAutoSettleLeg(leg)) return
    const at = tradeAt.get(leg.callerRef.batch)
    if (at === undefined) return
    const trade = trns[at]
    const adjacent = Math.abs(at - legAt) === 1
    const legFirst = legAt < at
    pairs.set(leg.id, { trade, edge: legFirst ? "top" : "bottom", adjacent })
    pairs.set(trade.id, { trade, edge: legFirst ? "bottom" : "top", adjacent })
  })
  return pairs
}

/**
 * Ladder order with each auto-settle leg directly above the trade it settles.
 * Legs are re-posted when a trade settles, so a day's legs can come after all
 * of its trades. A leg moves only within its trade's date, so each day closes
 * on the same balance; a leg whose trade is not on the ladder stays put.
 */
export function groupAutoSettleLegs(trns: Transaction[]): Transaction[] {
  const tradeAt = tradesByCallerId(trns)
  const legsOf = new Map<string, Transaction[]>()
  trns.forEach((trn) => {
    if (!isAutoSettleLeg(trn)) return
    const at = tradeAt.get(trn.callerRef.batch)
    const trade = at === undefined ? undefined : trns[at]
    if (!trade || trade.tradeDate !== trn.tradeDate) return
    legsOf.set(trade.id, [...(legsOf.get(trade.id) ?? []), trn])
  })
  const moved = new Set(
    Array.from(legsOf.values())
      .flat()
      .map((leg) => leg.id),
  )
  return trns.flatMap((trn) =>
    moved.has(trn.id) ? [] : [...(legsOf.get(trn.id) ?? []), trn],
  )
}

/** A ladder line: one entry, or a trade and its auto-settle leg folded together. */
export type LadderRow<T extends Transaction> =
  | { kind: "one"; trn: T; pair?: LadderPair }
  | { kind: "pair"; top: T; leg: T; trade: T }

/**
 * Folds each adjacent trade + leg pair into one line, unless the pair's trade
 * is in `open`. Every other row carries its pair, if it has one, so the page
 * never looks it up again.
 */
export function buildLadderRows<T extends Transaction>(
  trns: T[],
  pairs: Map<string, LadderPair>,
  open: Set<string>,
): LadderRow<T>[] {
  const rows: LadderRow<T>[] = []
  for (let i = 0; i < trns.length; i++) {
    const top = trns[i]
    const pair = pairs.get(top.id)
    const bottom = trns[i + 1]
    if (
      pair?.adjacent &&
      pair.edge === "top" &&
      bottom &&
      !open.has(pair.trade.id)
    ) {
      const tradeOnTop = pair.trade.id === top.id
      rows.push({
        kind: "pair",
        top,
        leg: tradeOnTop ? bottom : top,
        trade: tradeOnTop ? top : bottom,
      })
      i++
    } else {
      rows.push({ kind: "one", trn: top, pair })
    }
  }
  return rows
}
