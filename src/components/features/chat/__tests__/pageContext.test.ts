import { getPageContext } from "../pageContext"

describe("getPageContext", () => {
  it("returns news context for /news", () => {
    const ctx = getPageContext("/news")
    expect(ctx.page).toBe("News & Sentiment")
    expect(ctx.placeholder).toContain("news")
    expect(ctx.suggestions.length).toBeGreaterThan(0)
  })

  it("falls back via prefix match for /news/sub", () => {
    const ctx = getPageContext("/news/sub")
    expect(ctx.page).toBe("News & Sentiment")
  })

  it("returns default context for unknown routes", () => {
    const ctx = getPageContext("/unknown-page")
    expect(ctx.page).toBe("Home")
  })

  it("returns holdings context for /holdings", () => {
    const ctx = getPageContext("/holdings")
    expect(ctx.page).toBe("Holdings")
  })
})
