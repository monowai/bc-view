import {
  corporateActionsFrom,
  dividendsFrom,
  isOwedFrom,
} from "../corporateActionsFrom"
import { TrnType } from "types/beancounter"

describe("corporateActionsFrom", () => {
  it("a holding opened on its cost date looks for events from its first trade", () => {
    expect(
      corporateActionsFrom({
        opened: "2016-03-01",
        firstTransaction: "2026-11-18",
      }),
    ).toBe("2026-11-18")
  })

  it("a holding re-bought after selling out looks for events from when it re-opened", () => {
    expect(
      corporateActionsFrom({
        opened: "2022-05-10",
        firstTransaction: "2018-01-02",
      }),
    ).toBe("2022-05-10")
  })

  it("uses whichever date is known", () => {
    expect(
      corporateActionsFrom({ opened: "2020-01-01", firstTransaction: null }),
    ).toBe("2020-01-01")
    expect(
      corporateActionsFrom({ opened: null, firstTransaction: "2020-01-01" }),
    ).toBe("2020-01-01")
  })

  it("is undefined when neither date is known", () => {
    expect(corporateActionsFrom(undefined)).toBeUndefined()
    expect(
      corporateActionsFrom({ opened: null, firstTransaction: null }),
    ).toBeUndefined()
  })
})

describe("dividendsFrom", () => {
  it("an imported holding is owed dividends from its cost date, when it opened", () => {
    expect(
      dividendsFrom({ opened: "2016-01-04", firstTransaction: "2026-11-18" }),
    ).toBe("2016-01-04")
  })

  it("a holding re-bought after selling out is owed dividends from when it re-opened", () => {
    expect(
      dividendsFrom({ opened: "2022-05-10", firstTransaction: "2018-01-02" }),
    ).toBe("2022-05-10")
  })

  it("falls back to the first trade, and is undefined when neither is known", () => {
    expect(
      dividendsFrom({ opened: null, firstTransaction: "2020-01-01" }),
    ).toBe("2020-01-01")
    expect(dividendsFrom(undefined)).toBeUndefined()
  })
})

describe("isOwedFrom", () => {
  const event = (
    trnType: TrnType,
    recordDate: string,
  ): { trnType: TrnType; recordDate: string } => ({ trnType, recordDate })

  it("owes a dividend recorded before the first trade", () => {
    expect(isOwedFrom(event("DIVI", "2018-05-10"), "2026-11-18")).toBe(true)
  })

  it("never owes a split, or any other event, recorded before the first trade", () => {
    expect(isOwedFrom(event("SPLIT", "2020-08-31"), "2026-11-18")).toBe(false)
    expect(isOwedFrom(event("COST_ADJUST", "2020-08-31"), "2026-11-18")).toBe(
      false,
    )
  })

  it("owes a split recorded on or after the first trade", () => {
    expect(isOwedFrom(event("SPLIT", "2026-11-18"), "2026-11-18")).toBe(true)
    expect(isOwedFrom(event("SPLIT", "2027-01-04"), "2026-11-18")).toBe(true)
  })

  it("owes anything when the first trade is not known", () => {
    expect(isOwedFrom(event("SPLIT", "2020-08-31"), undefined)).toBe(true)
  })
})
