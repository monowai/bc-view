import { CorporateEvent, Transaction } from "types/beancounter"
import {
  calculateEffectivePayDate,
  getMatchingTransaction,
} from "../eventUtils"

const dividend = (recordDate: string): CorporateEvent =>
  ({
    id: "event-1",
    trnType: "DIVI",
    recordDate,
    payDate: recordDate,
  }) as CorporateEvent

// The DST cases only bite when the run's zone changes clocks in that window
// (e.g. TZ=America/New_York or TZ=Europe/Berlin); in any zone they must hold.
describe("calculateEffectivePayDate", () => {
  it("adds 18 days to the record date of a dividend", () => {
    expect(calculateEffectivePayDate(dividend("2026-01-10"))).toBe("2026-01-28")
  })

  it("keeps 18 days across the March daylight-saving change", () => {
    expect(calculateEffectivePayDate(dividend("2026-03-01"))).toBe("2026-03-19")
  })

  it("keeps 18 days across the October daylight-saving change", () => {
    expect(calculateEffectivePayDate(dividend("2026-10-20"))).toBe("2026-11-07")
  })

  it("returns the pay date unchanged for a split", () => {
    const split = {
      ...dividend("2026-01-10"),
      trnType: "SPLIT",
      payDate: "2026-02-01",
    }
    expect(calculateEffectivePayDate(split as CorporateEvent)).toBe(
      "2026-02-01",
    )
  })
})

describe("getMatchingTransaction", () => {
  const trnOn = (tradeDate: string): Transaction =>
    ({ id: "trn-1", trnType: "DIVI", tradeDate }) as Transaction

  it("matches a trade exactly 20 days after the pay date across daylight saving", () => {
    const event = dividend("2026-02-10")
    event.payDate = "2026-03-01"
    expect(getMatchingTransaction(event, [trnOn("2026-03-21")])?.id).toBe(
      "trn-1",
    )
  })

  it("does not match a trade 21 days after the pay date", () => {
    const event = dividend("2026-02-10")
    event.payDate = "2026-03-01"
    expect(getMatchingTransaction(event, [trnOn("2026-03-22")])).toBeUndefined()
  })
})
