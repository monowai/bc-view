import { buildChatContext } from "@components/features/chat/chatContext"
import { getPageContext } from "@components/features/chat/pageContext"

function build(
  pathname: string,
  query: Record<string, string | string[] | undefined> = {},
  live: string | null = null,
): Record<string, unknown> {
  return buildChatContext(pathname, query, getPageContext(pathname), live)
}

describe("buildChatContext", () => {
  it("names the plan being viewed on /independence", () => {
    const ctx = build("/independence", { plan: "abc" })
    expect(ctx.page).toBe("Independence Planning")
    expect(ctx.independencePlanId).toBe("abc")
    expect(ctx).not.toHaveProperty("phaseId")
  })

  it("sends neither id on /independence when no plan is selected", () => {
    const ctx = build("/independence")
    expect(ctx).not.toHaveProperty("independencePlanId")
    expect(ctx).not.toHaveProperty("phaseId")
  })

  it("ignores an empty or repeated plan param", () => {
    expect(build("/independence", { plan: "" })).not.toHaveProperty(
      "independencePlanId",
    )
    expect(build("/independence", { plan: ["a", "b"] })).not.toHaveProperty(
      "independencePlanId",
    )
  })

  it("sends phaseId, not entityId, on the single-phase page", () => {
    const ctx = build("/independence/plans/[id]", { id: "p1" })
    expect(ctx.page).toBe("Independence Phase")
    expect(ctx.phaseId).toBe("p1")
    expect(ctx).not.toHaveProperty("entityId")
    expect(ctx).not.toHaveProperty("independencePlanId")
  })

  it("carries the plan alongside the phase when both are in the URL", () => {
    const ctx = build("/independence/plans/[id]", { id: "p1", plan: "abc" })
    expect(ctx.phaseId).toBe("p1")
    expect(ctx.independencePlanId).toBe("abc")
  })

  it("sends phaseId on the phase wizard", () => {
    const ctx = build("/independence/wizard/[planId]", { planId: "p2" })
    expect(ctx.page).toBe("Independence Phase")
    expect(ctx.phaseId).toBe("p2")
  })

  it("never reads the wizard's [planId] segment as the journey id", () => {
    // The wizard edits one phase; its segment is a phase id despite the name.
    const ctx = build("/independence/wizard/[planId]", {
      planId: "p2",
      plan: "abc",
    })
    expect(ctx.phaseId).toBe("p2")
    expect(ctx.independencePlanId).toBe("abc")
    expect(ctx).not.toHaveProperty("entityId")
  })

  it("does not read a plan param outside independence routes", () => {
    const ctx = build("/independencex", { plan: "abc" })
    expect(ctx).not.toHaveProperty("independencePlanId")
  })

  it("still sends entityId for other routes with an id", () => {
    const ctx = build("/rebalance/plans/[id]", { id: "r1" })
    expect(ctx.entityId).toBe("r1")
    expect(ctx).not.toHaveProperty("phaseId")
  })

  it("keeps modelId, portfolioCode and portfolioId as before", () => {
    expect(
      build("/rebalance/models/[modelId]", { modelId: "m1" }).modelId,
    ).toBe("m1")
    const byCode = build("/holdings/[code]", { code: "TEST" })
    expect(byCode.portfolioCode).toBe("TEST")
    expect(byCode).not.toHaveProperty("portfolioId")
    const byId = build("/holdings/[code]", { code: "pid", byId: "1" })
    expect(byId.portfolioId).toBe("pid")
    expect(byId).not.toHaveProperty("portfolioCode")
  })

  it("folds live page context in as currentState", () => {
    expect(build("/rebalance", {}, "draft").currentState).toBe("draft")
    expect(build("/rebalance")).not.toHaveProperty("currentState")
  })
})
