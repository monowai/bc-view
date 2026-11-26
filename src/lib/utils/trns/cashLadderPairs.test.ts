import { Transaction } from "types/beancounter"
import { groupAutoSettleLegs, pairAutoSettleRows } from "./cashLadderPairs"

const trade = (
  id: string,
  callerId: string,
  tradeDate = "2026-11-05",
): Transaction =>
  ({
    id,
    tradeDate,
    trnType: "BUY",
    callerRef: { provider: "BC", batch: "20261125", callerId },
  }) as unknown as Transaction

const leg = (
  id: string,
  batch: string,
  tradeDate = "2026-11-05",
): Transaction =>
  ({
    id,
    tradeDate,
    trnType: "DEPOSIT",
    callerRef: { provider: "BC-AUTO", batch, callerId: `${id}-c` },
  }) as unknown as Transaction

const plain = (id: string, tradeDate = "2026-11-05"): Transaction =>
  ({
    id,
    tradeDate,
    trnType: "DEPOSIT",
    callerRef: null,
  }) as unknown as Transaction

describe("pairAutoSettleRows", () => {
  it("pairs a leg with the trade it settles, leg above", () => {
    const pairs = pairAutoSettleRows([leg("l1", "c1"), trade("t1", "c1")])

    expect(pairs.get("l1")).toEqual({
      tradeId: "t1",
      trade: expect.objectContaining({ id: "t1" }),
      edge: "top",
      adjacent: true,
    })
    expect(pairs.get("t1")).toEqual({
      tradeId: "t1",
      trade: expect.objectContaining({ id: "t1" }),
      edge: "bottom",
      adjacent: true,
    })
  })

  it("marks a pair split by another row as not adjacent", () => {
    const pairs = pairAutoSettleRows([
      leg("l1", "c1"),
      plain("d1"),
      trade("t1", "c1"),
    ])

    expect(pairs.get("l1")?.adjacent).toBe(false)
    expect(pairs.get("d1")).toBeUndefined()
  })

  it("leaves a leg whose trade is in another portfolio unpaired", () => {
    const pairs = pairAutoSettleRows([
      leg("l1", "elsewhere"),
      trade("t1", "c1"),
    ])

    expect(pairs.size).toBe(0)
  })
})

describe("groupAutoSettleLegs", () => {
  const ids = (trns: Transaction[]): string[] => trns.map((t) => t.id)

  it("moves each leg above its trade when the legs were posted together", () => {
    const grouped = groupAutoSettleLegs([
      leg("l3", "c3"),
      leg("l2", "c2"),
      leg("l1", "c1"),
      trade("t3", "c3"),
      trade("t2", "c2"),
      trade("t1", "c1"),
    ])

    expect(ids(grouped)).toEqual(["l3", "t3", "l2", "t2", "l1", "t1"])
  })

  it("keeps other rows where they were", () => {
    const grouped = groupAutoSettleLegs([
      plain("d1"),
      leg("l1", "c1"),
      plain("d2"),
      trade("t1", "c1"),
    ])

    expect(ids(grouped)).toEqual(["d1", "d2", "l1", "t1"])
  })

  it("never moves a leg across a trade date", () => {
    const grouped = groupAutoSettleLegs([
      leg("l1", "c1", "2026-11-06"),
      trade("t1", "c1", "2026-11-05"),
    ])

    expect(ids(grouped)).toEqual(["l1", "t1"])
  })

  it("leaves a leg whose trade is not on the ladder in place", () => {
    const grouped = groupAutoSettleLegs([
      leg("l1", "elsewhere"),
      trade("t1", "c1"),
    ])

    expect(ids(grouped)).toEqual(["l1", "t1"])
  })
})
