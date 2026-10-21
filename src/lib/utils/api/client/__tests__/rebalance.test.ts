import {
  assetModelsKey,
  commitExecution,
  deleteModel,
  executionKey,
  executionsKey,
  modelKey,
  modelPlanKey,
  modelPlansKey,
  modelsKey,
  approvedModelPlansUrl,
  planPricesUrl,
  weightsFromHoldingsUrl,
} from "@utils/api/client/rebalance"

describe("rebalance api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(modelsKey).toBe("/api/rebalance/models")
    expect(executionsKey).toBe("/api/rebalance/executions")
    expect(modelKey("m1")).toBe("/api/rebalance/models/m1")
    expect(executionKey("e1")).toBe("/api/rebalance/executions/e1")
    expect(modelPlansKey("m1")).toBe("/api/rebalance/models/m1/plans")
    expect(modelPlanKey("m1", "p1")).toBe("/api/rebalance/models/m1/plans/p1")
    expect(approvedModelPlansUrl("m1")).toBe(
      "/api/rebalance/models/m1/plans/approved",
    )
    expect(planPricesUrl("m1", "p1")).toBe(
      "/api/rebalance/models/m1/plans/p1/prices",
    )
    expect(weightsFromHoldingsUrl("m1", "pf", "USD")).toBe(
      "/api/rebalance/models/m1/plans/weights-from-holdings?portfolioId=pf&valueCurrency=USD",
    )
    expect(assetModelsKey("a1")).toBe("/api/rebalance/assets/a1/models")
  })
})

describe("rebalance api requests", () => {
  it("commits an execution as JSON", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await commitExecution("e1", { portfolioId: "p" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rebalance/executions/e1/commit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"portfolioId":"p"}',
      },
    )
  })

  it("deletes a model without headers", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 404 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await deleteModel("m1")
    expect(res.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/rebalance/models/m1", {
      method: "DELETE",
    })
  })
})
