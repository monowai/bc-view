import {
  activePortfoliosKey,
  deletePortfolio,
  mergePortfolios,
  portfolioKey,
  portfoliosExportUrl,
  portfoliosKey,
} from "@utils/api/client/portfolios"

describe("portfolios api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(activePortfoliosKey).toBe("/api/portfolios")
    expect(portfoliosKey).toBe("/api/portfolios?inactive=true")
    expect(portfolioKey("p1")).toBe("/api/portfolios/p1")
    expect(portfoliosExportUrl).toBe("/api/portfolios/export")
  })
})

describe("portfolios api requests", () => {
  it("merges with a bodiless JSON POST", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await mergePortfolios("a", "b")
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolios/a/merge/b", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  })

  it("returns a failed delete to the caller", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 409 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await deletePortfolio("p1")
    expect(res.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledWith("/api/portfolios/p1", {
      method: "DELETE",
    })
  })
})
