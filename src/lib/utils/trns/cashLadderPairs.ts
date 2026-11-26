import { Transaction } from "types/beancounter"
import { isAutoSettleLeg } from "@lib/trns/tradeUtils"

/** A ladder row's place in a trade + auto-settle leg pair. */
export interface LadderPair {
  /** The trade the pair is named for. */
  tradeId: string
  trade: Transaction
  /** Which end of the pair this row is, in ladder order. */
  edge: "top" | "bottom"
  /** The two rows sit next to each other, so a bracket can join them. */
  adjacent: boolean
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
  const tradeAt = new Map<string, number>()
  trns.forEach((trn, i) => {
    const callerId = trn.callerRef?.callerId
    if (callerId && !isAutoSettleLeg(trn)) tradeAt.set(callerId, i)
  })
  const pairs = new Map<string, LadderPair>()
  trns.forEach((leg, legAt) => {
    if (!isAutoSettleLeg(leg)) return
    const at = tradeAt.get(leg.callerRef.batch)
    if (at === undefined) return
    const trade = trns[at]
    const adjacent = Math.abs(at - legAt) === 1
    const legFirst = legAt < at
    pairs.set(leg.id, {
      tradeId: trade.id,
      trade,
      edge: legFirst ? "top" : "bottom",
      adjacent,
    })
    pairs.set(trade.id, {
      tradeId: trade.id,
      trade,
      edge: legFirst ? "bottom" : "top",
      adjacent,
    })
  })
  return pairs
}
