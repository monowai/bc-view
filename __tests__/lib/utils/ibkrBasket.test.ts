import { buildIbkrBasketCsv, ibkrBasketFilename } from "@lib/ibkrBasket"
import { Transaction } from "types/beancounter"

const HEADER =
  "Action,Quantity,Symbol,SecType,Exchange,Currency,TimeInForce,OrderType,LmtPrice,BasketTag"

const makeTrn = (overrides: Record<string, unknown> = {}): Transaction =>
  ({
    id: "trn-1",
    callerRef: { provider: "BC", batch: "b1", callerId: "caller-1" },
    trnType: "BUY",
    status: "PROPOSED",
    quantity: 10,
    price: 5.25,
    tradeCurrency: { code: "USD" },
    asset: {
      id: "asset-1",
      code: "AAPL",
      name: "Apple Inc",
      market: { code: "NASDAQ" },
    },
    ...overrides,
  }) as unknown as Transaction

describe("buildIbkrBasketCsv", () => {
  it("returns header only for empty input", () => {
    expect(buildIbkrBasketCsv([])).toBe(HEADER)
  })

  it("emits the exact TWS header with no spaces after commas", () => {
    const csv = buildIbkrBasketCsv([makeTrn()])
    const lines = csv.split("\n")
    expect(lines[0]).toBe(HEADER)
    lines.forEach((line) => {
      expect(line).not.toContain(", ")
    })
  })

  it("maps BUY and SELL rows with LMT order when price is positive", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({ id: "t-buy", trnType: "BUY", quantity: 10, price: 5.25 }),
      makeTrn({
        id: "t-sell",
        trnType: "SELL",
        quantity: -4,
        price: 100,
        asset: {
          id: "a2",
          code: "VOD",
          name: "Vodafone",
          market: { code: "LON" },
        },
        tradeCurrency: { code: "GBP" },
      }),
    ])
    const lines = csv.split("\n")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe("BUY,10,AAPL,STK,SMART,USD,DAY,LMT,5.25,BC-t-buy")
    expect(lines[2]).toBe("SELL,4,VOD,STK,LSE,GBP,DAY,LMT,100,BC-t-sell")
  })

  it("skips non-trade transaction types", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({ id: "t1", trnType: "DIVI" }),
      makeTrn({ id: "t2", trnType: "FX_BUY" }),
      makeTrn({ id: "t3", trnType: "DEPOSIT" }),
      makeTrn({ id: "t4", trnType: "WITHDRAWAL" }),
      makeTrn({ id: "t5", trnType: "SPLIT" }),
      makeTrn({ id: "t6", trnType: "BALANCE" }),
      makeTrn({ id: "t7", trnType: "BUY" }),
    ])
    const lines = csv.split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain("BC-t7")
  })

  it("falls back to MKT with blank LmtPrice when price is missing or non-positive", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({ id: "t-null", price: null }),
      makeTrn({ id: "t-zero", price: 0 }),
      makeTrn({ id: "t-neg", price: -1 }),
    ])
    const lines = csv.split("\n")
    expect(lines[1]).toBe("BUY,10,AAPL,STK,SMART,USD,DAY,MKT,,BC-t-null")
    expect(lines[2]).toBe("BUY,10,AAPL,STK,SMART,USD,DAY,MKT,,BC-t-zero")
    expect(lines[3]).toBe("BUY,10,AAPL,STK,SMART,USD,DAY,MKT,,BC-t-neg")
  })

  it.each([
    ["NYSE", "SMART"],
    ["NASDAQ", "SMART"],
    ["US", "SMART"],
    ["AMEX", "SMART"],
    ["LON", "LSE"],
    ["LSE", "LSE"],
    ["ASX", "ASX"],
    ["SGX", "SGX"],
    ["NZX", "NZSE"],
    ["TSX", "TSE"],
    ["XETRA", "SMART"], // unmapped market falls back to SMART
  ])("maps market %s to exchange %s", (market, exchange) => {
    const csv = buildIbkrBasketCsv([
      makeTrn({
        asset: { id: "a", code: "X", name: "X", market: { code: market } },
      }),
    ])
    expect(csv.split("\n")[1].split(",")[4]).toBe(exchange)
  })

  it("formats quantity as absolute plain decimal with trailing zeros stripped", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({ id: "t1", quantity: -12.5 }),
      makeTrn({ id: "t2", quantity: 100.0 }),
      makeTrn({ id: "t3", quantity: 0.123456 }),
    ])
    const lines = csv.split("\n")
    expect(lines[1].split(",")[1]).toBe("12.5")
    expect(lines[2].split(",")[1]).toBe("100")
    expect(lines[3].split(",")[1]).toBe("0.123456")
  })

  it("uses callerRef.callerId in the BasketTag when id is absent", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({
        id: undefined,
        callerRef: { provider: "BC", batch: "b", callerId: "cr-9" },
      }),
    ])
    expect(csv.split("\n")[1].split(",")[9]).toBe("BC-cr-9")
  })

  it("escapes symbol fields containing commas", () => {
    const csv = buildIbkrBasketCsv([
      makeTrn({
        asset: {
          id: "a",
          code: "WEIRD,CODE",
          name: "X",
          market: { code: "NYSE" },
        },
      }),
    ])
    expect(csv.split("\n")[1]).toContain('"WEIRD,CODE"')
  })
})

describe("ibkrBasketFilename", () => {
  it("builds a dated filename", () => {
    expect(ibkrBasketFilename("2026-07-10")).toBe("ibkr-basket-2026-07-10.csv")
  })
})
