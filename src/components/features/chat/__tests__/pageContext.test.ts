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

  it("treats the single-phase routes as Independence Phase", () => {
    expect(getPageContext("/independence/plans/[id]").page).toBe(
      "Independence Phase",
    )
    expect(getPageContext("/independence/wizard/[planId]").page).toBe(
      "Independence Phase",
    )
  })

  it("tells viewing a phase apart from editing one", () => {
    const viewing = getPageContext("/independence/plans/[id]")
    const editing = getPageContext("/independence/wizard/[planId]")
    expect(viewing.description).toContain("viewing a single phase")
    expect(editing.description).toContain("editing a single phase")
    expect(editing.placeholder).toBe(viewing.placeholder)
    expect(editing.suggestions).toEqual(viewing.suggestions)
  })

  it("keeps /independence as the whole-plan view", () => {
    const ctx = getPageContext("/independence")
    expect(ctx.page).toBe("Independence Planning")
    expect(ctx.description).toContain("all phases")
  })
})
