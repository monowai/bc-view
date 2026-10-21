import {
  deleteOffboardData,
  deleteTaxRate,
  meKey,
  offboardSummaryUrl,
  taxRatesKey,
  updateMe,
} from "@utils/api/client/account"
import {
  brokerUrl,
  brokersKey,
  brokersWithAccountsKey,
  transferBrokerHoldings,
} from "@utils/api/client/brokers"
import {
  marketPriceUrl,
  priceHistoryKey,
  priceQuoteKey,
  writePrice,
} from "@utils/api/client/prices"

describe("account, broker and price api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(meKey).toBe("/api/me")
    expect(taxRatesKey).toBe("/api/tax-rates")
    expect(brokersKey).toBe("/api/brokers")
    expect(brokersWithAccountsKey).toBe("/api/brokers?includeAccounts=true")
    expect(brokerUrl("b1")).toBe("/api/brokers/b1")
    expect(offboardSummaryUrl).toBe("/api/offboard/summary")
    expect(priceHistoryKey("a1", "2026-01-01", "2026-02-01")).toBe(
      "/api/prices/history/a1?from=2026-01-01&to=2026-02-01",
    )
    expect(priceQuoteKey("a1")).toBe("/api/prices/a1/quote")
    expect(marketPriceUrl("NASDAQ", "AAPL")).toBe("/api/prices/NASDAQ/AAPL")
  })
})

describe("account, broker and price api requests", () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it("patches the user's settings", async () => {
    await updateMe({ milestoneMode: "SIMPLE" })
    expect(global.fetch).toHaveBeenCalledWith("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"milestoneMode":"SIMPLE"}',
    })
  })

  it("writes a price", async () => {
    await writePrice({ assetId: "a1", date: "2026-01-01", closePrice: 1 })
    expect(global.fetch).toHaveBeenCalledWith("/api/prices/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"assetId":"a1","date":"2026-01-01","closePrice":1}',
    })
  })

  it("issues bare DELETE / POST requests", async () => {
    await deleteTaxRate("NZ")
    await deleteOffboardData("plans")
    await transferBrokerHoldings("b1", "b2")
    expect(global.fetch).toHaveBeenCalledWith("/api/tax-rates/NZ", {
      method: "DELETE",
    })
    expect(global.fetch).toHaveBeenCalledWith("/api/offboard/plans", {
      method: "DELETE",
    })
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/brokers/b1/transfer?toBrokerId=b2",
      { method: "POST" },
    )
  })

  it("hands a failed response back to the caller", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 400 }) as unknown as typeof fetch
    const res = await updateMe({})
    expect(res.status).toBe(400)
  })
})
