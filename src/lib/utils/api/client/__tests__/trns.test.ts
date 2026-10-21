import {
  brokerTrnHoldingsKey,
  cashLadderKey,
  createTrns,
  deleteTrn,
  eventKey,
  incomeMonthlyKey,
  investmentsMonthlyKey,
  investmentsMonthlyTransactionsKey,
  isProposedTrnsKey,
  proposedCountKey,
  proposedTrnsKey,
  settledTrnsUrl,
  settlePortfolioTrns,
  tradeKey,
  tradeKeyMulti,
  trnKey,
  trnsKey,
} from "@utils/api/client/trns"

describe("trns api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(trnsKey).toBe("/api/trns")
    expect(trnKey("t1")).toBe("/api/trns/t1")
    expect(tradeKey("p1", "a1")).toBe("/api/trns/trades/p1/a1")
    expect(tradeKeyMulti("a1", ["p1", "p2"])).toBe(
      "/api/trns/trades/a1?portfolios=p1,p2",
    )
    expect(eventKey("p1", "a1")).toBe("/api/trns/events/p1/a1")
    expect(proposedTrnsKey("ALL", "2026-01-31")).toBe(
      "/api/trns/proposed?scope=ALL&asAt=2026-01-31",
    )
    expect(proposedCountKey).toBe("/api/trns/proposed/count")
    expect(settledTrnsUrl("2026-01-01", "2026-01-31")).toBe(
      "/api/trns/settled?from=2026-01-01&to=2026-01-31",
    )
    expect(incomeMonthlyKey(new URLSearchParams({ months: "12" }))).toBe(
      "/api/trns/income/monthly?months=12",
    )
    expect(investmentsMonthlyKey("USD")).toBe(
      "/api/trns/investments/monthly?currency=USD&days=30",
    )
    expect(investmentsMonthlyTransactionsKey).toBe(
      "/api/trns/investments/monthly/transactions?days=30",
    )
    expect(brokerTrnHoldingsKey("b1")).toBe("/api/trns/broker/b1/holdings")
    expect(cashLadderKey("p1", "c1")).toBe(
      "/api/trns/portfolio/p1/cash-ladder/c1",
    )
  })

  it("matches every proposed-trns cache key", () => {
    expect(isProposedTrnsKey(proposedCountKey)).toBe(true)
    expect(isProposedTrnsKey(proposedTrnsKey("ALL", "x"))).toBe(true)
    expect(isProposedTrnsKey("/api/trns/settled")).toBe(false)
    expect(isProposedTrnsKey(["/api/trns/proposed"])).toBe(false)
  })
})

describe("trns api requests", () => {
  it("posts new trns as JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    await createTrns({ portfolioId: "p1", data: [] })
    expect(fetchMock).toHaveBeenCalledWith("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"portfolioId":"p1","data":[]}',
    })
  })

  it("settles a portfolio's trns", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    global.fetch = fetchMock as unknown as typeof fetch

    const res = await settlePortfolioTrns("p1", ["t1"])
    expect(res.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/trns/portfolio/p1/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"trnIds":["t1"]}',
    })
  })

  it("deletes a trade without headers", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await deleteTrn("t1")
    expect(fetchMock).toHaveBeenCalledWith("/api/trns/trades/t1", {
      method: "DELETE",
    })
  })
})
