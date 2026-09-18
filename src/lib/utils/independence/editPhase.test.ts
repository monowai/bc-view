import { editPhaseHref, resolveReturnTo, returnToLabel } from "./editPhase"

describe("resolveReturnTo", () => {
  it("returns the caller to exactly where they were, query and all", () => {
    // The journey and section live in the query string, so dropping it lands
    // the reader on a different plan than the one they were reading.
    expect(resolveReturnTo("/independence?view=stages&plan=j1")).toBe(
      "/independence?view=stages&plan=j1",
    )
    expect(resolveReturnTo("/independence/plans/p1")).toBe(
      "/independence/plans/p1",
    )
  })

  it("falls back to the plan when nothing was asked for", () => {
    expect(resolveReturnTo(undefined)).toBe("/independence")
    expect(resolveReturnTo("")).toBe("/independence")
  })

  it("refuses to send the user off-site", () => {
    // The target rides in the URL. A protocol-relative path is absolute to the
    // browser, so it has to be rejected as firmly as a full URL.
    expect(resolveReturnTo("//evil.example")).toBe("/independence")
    expect(resolveReturnTo("https://evil.example")).toBe("/independence")
    expect(resolveReturnTo("javascript:alert(1)")).toBe("/independence")
  })

  it("refuses a path that only looks like Independence", () => {
    expect(resolveReturnTo("/independencelookalike")).toBe("/independence")
    expect(resolveReturnTo("/wealth")).toBe("/independence")
  })

  it("takes the first value when the param is repeated", () => {
    expect(resolveReturnTo(["/independence?view=plan", "/wealth"])).toBe(
      "/independence?view=plan",
    )
  })
})

describe("editPhaseHref", () => {
  it("carries the caller's location and the step it wants", () => {
    const href = editPhaseHref(
      "p1",
      "/independence?view=plan&plan=j1",
      "expenses",
    )
    const url = new URL(href, "http://x")
    expect(url.pathname).toBe("/independence/wizard/p1")
    expect(url.searchParams.get("step")).toBe("expenses")
    expect(url.searchParams.get("returnTo")).toBe(
      "/independence?view=plan&plan=j1",
    )
  })

  it("omits the step when the caller has no opinion", () => {
    const href = editPhaseHref("p1", "/independence")
    expect(href).not.toContain("step=")
    expect(new URL(href, "http://x").searchParams.get("returnTo")).toBe(
      "/independence",
    )
  })
})

describe("returnToLabel", () => {
  it("names the destination rather than saying 'back'", () => {
    expect(returnToLabel("/independence?view=plan")).toBe("Back to your plan")
    expect(returnToLabel("/independence/plans/p1")).toBe("Back to this stage")
  })
})
