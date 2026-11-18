import { makeCashAsset, makeTrn, SGD, USD } from "@test-fixtures/beancounter"
import {
  anyNonZero,
  groupByYear,
  settlementLabel,
  tabSignal,
  uniformCurrency,
} from "../trnListView"

describe("anyNonZero", () => {
  it("is false when every value of the field is zero or missing", () => {
    const trns = [makeTrn({ fees: 0 }), makeTrn({ fees: undefined })]
    expect(anyNonZero(trns, "fees")).toBe(false)
  })

  it("is true when one value of the field is not zero", () => {
    const trns = [makeTrn({ tax: 0 }), makeTrn({ tax: 1.2 })]
    expect(anyNonZero(trns, "tax")).toBe(true)
  })
})

describe("uniformCurrency", () => {
  it("returns the trade currency code that every transaction shares", () => {
    expect(uniformCurrency([makeTrn(), makeTrn()])).toBe("USD")
  })

  it("returns undefined when trade currencies differ", () => {
    expect(
      uniformCurrency([makeTrn(), makeTrn({ tradeCurrency: SGD })]),
    ).toBeUndefined()
  })

  it("returns undefined for no transactions", () => {
    expect(uniformCurrency([])).toBeUndefined()
  })
})

describe("groupByYear", () => {
  it("groups by trade-date year, newest year first, keeping row order", () => {
    const trns = [
      makeTrn({ id: "a", tradeDate: "2025-08-01", tradeAmount: 2, tax: 1 }),
      makeTrn({ id: "b", tradeDate: "2025-02-01", tradeAmount: 3, tax: 0.5 }),
      makeTrn({ id: "c", tradeDate: "2024-11-01", tradeAmount: 4, tax: 0 }),
    ]
    const years = groupByYear(trns)
    expect(years.map((y) => y.year)).toEqual(["2025", "2024"])
    expect(years[0].transactions.map((t) => t.id)).toEqual(["a", "b"])
    expect(years[0].totals).toEqual({ tradeAmount: 5, tax: 1.5 })
    expect(years[1].totals).toEqual({ tradeAmount: 4, tax: 0 })
  })
})

describe("settlementLabel", () => {
  it("is blank for types that move no cash", () => {
    expect(settlementLabel(makeTrn({ trnType: "SPLIT" }))).toBeUndefined()
    expect(settlementLabel(makeTrn({ trnType: "COST_ADJUST" }))).toBeUndefined()
  })

  it("names the cash asset the trade settled to", () => {
    const cash = { ...makeCashAsset(USD), name: "USD Balance" }
    expect(settlementLabel(makeTrn({ cashAsset: cash }))).toBe("USD Balance")
  })

  it("falls back to the cash currency balance", () => {
    expect(settlementLabel(makeTrn({ cashAsset: undefined }))).toBe(
      "USD Balance",
    )
  })
})

describe("tabSignal", () => {
  it("is undefined while the list loads", () => {
    expect(tabSignal(undefined)).toBeUndefined()
  })

  it("counts rows and the ones still proposed", () => {
    expect(
      tabSignal([
        makeTrn({ status: "PROPOSED" }),
        makeTrn(),
        makeTrn({ status: "PROPOSED" }),
      ]),
    ).toEqual({ count: 3, proposed: 2 })
  })
})
