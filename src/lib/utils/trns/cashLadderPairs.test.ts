import { Transaction } from "types/beancounter"
import { pairAutoSettleRows } from "./cashLadderPairs"

const trade = (id: string, callerId: string): Transaction =>
  ({
    id,
    trnType: "BUY",
    callerRef: { provider: "BC", batch: "20261125", callerId },
  }) as unknown as Transaction

const leg = (id: string, batch: string): Transaction =>
  ({
    id,
    trnType: "DEPOSIT",
    callerRef: { provider: "BC-AUTO", batch, callerId: `${id}-c` },
  }) as unknown as Transaction

const plain = (id: string): Transaction =>
  ({ id, trnType: "DEPOSIT", callerRef: null }) as unknown as Transaction

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
