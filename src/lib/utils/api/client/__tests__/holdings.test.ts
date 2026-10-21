import {
  aggregatePerformance,
  aggregatedHoldingsCodesKey,
  aggregatedHoldingsTodayKey,
  aggregatedHoldingsQueryUrl,
  benchmarkPerformanceKey,
  brokerHoldingsKey,
  holdingByIdKey,
  holdingKey,
  holdingsAllocationUrl,
  netWorthUrl,
  performanceKey,
  resetPerformanceCache,
} from "@utils/api/client/holdings"

describe("holdings api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(holdingKey("P1", "today")).toBe("/api/holdings/P1?asAt=today")
    expect(holdingByIdKey("p1", "today")).toBe("/api/holdings/id/p1?asAt=today")
    expect(aggregatedHoldingsTodayKey).toBe(
      "/api/holdings/aggregated?asAt=today",
    )
    expect(aggregatedHoldingsCodesKey()).toBe(
      "/api/holdings/aggregated?asAt=today",
    )
    expect(aggregatedHoldingsCodesKey("A,B")).toBe(
      "/api/holdings/aggregated?asAt=today&codes=A%2CB",
    )
    expect(
      aggregatedHoldingsQueryUrl(new URLSearchParams({ asAt: "today" })),
    ).toBe("/api/holdings/aggregated?asAt=today")
    expect(holdingsAllocationUrl("a,b")).toBe(
      "/api/holdings/allocation?asAt=today&ids=a%2Cb",
    )
    expect(brokerHoldingsKey("b1")).toBe("/api/holdings/broker/b1?value=false")
    expect(performanceKey("P1", 12)).toBe("/api/performance/P1?months=12")
    expect(benchmarkPerformanceKey("P1", "i d", 12)).toBe(
      "/api/performance/P1/benchmark?indexAssetId=i%20d&months=12",
    )
    expect(netWorthUrl(new URLSearchParams({ currency: "USD" }))).toBe(
      "/api/net-worth?currency=USD",
    )
  })
})

describe("holdings api requests", () => {
  it("resets a portfolio's performance cache", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await resetPerformanceCache("P1")
    expect(fetchMock).toHaveBeenCalledWith("/api/performance/P1/reset", {
      method: "DELETE",
    })
  })

  it("posts the aggregate performance request", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await aggregatePerformance({ portfolioCodes: ["P1"] })
    expect(res.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/performance/aggregate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"portfolioCodes":["P1"]}',
    })
  })
})
