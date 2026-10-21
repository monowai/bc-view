import {
  compositeMonteCarloUrl,
  compositeProjectionUrl,
  compositeScenariosUrl,
  copyPlan,
  cpfBalanceSeriesUrl,
  cpfContributionPreviewKey,
  cpfPolicyBalanceSeriesUrl,
  definedContributionKey,
  deletedWorkScenariosKey,
  deletePlanProperty,
  expenseCategoriesKey,
  independencePlansKey,
  independenceScenariosKey,
  independenceSettingsKey,
  lifestyleCatalogKey,
  lumpSumProjectionUrl,
  monteCarloUrl,
  planDetailsKey,
  planExpenseUrl,
  planExpensesKey,
  planKey,
  planPropertiesKey,
  plansKey,
  projectionKey,
  setPrimaryPlan,
  updateIndependenceSettings,
  workScenarioContributionsKey,
  workScenarioKey,
  workScenariosKey,
} from "@utils/api/client/independence"

describe("independence api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(plansKey).toBe("/api/independence/plans")
    expect(planKey("p1")).toBe("/api/independence/plans/p1")
    expect(planDetailsKey("p1")).toBe("/api/independence/plans/p1/details")
    expect(planExpensesKey("p1")).toBe("/api/independence/plans/p1/expenses")
    expect(planExpenseUrl("p1", "e1")).toBe(
      "/api/independence/plans/p1/expenses/e1",
    )
    expect(planPropertiesKey("p1")).toBe(
      "/api/independence/plans/p1/properties",
    )
    expect(independencePlansKey).toBe("/api/independence/independence-plans")
    expect(workScenariosKey).toBe("/api/independence/work-scenarios")
    expect(workScenarioKey("w1")).toBe("/api/independence/work-scenarios/w1")
    expect(deletedWorkScenariosKey).toBe(
      "/api/independence/work-scenarios/deleted",
    )
    expect(workScenarioContributionsKey("w1")).toBe(
      "/api/independence/work-scenarios/w1/contributions",
    )
    expect(independenceSettingsKey).toBe("/api/independence/settings")
    expect(expenseCategoriesKey).toBe("/api/independence/categories")
    expect(independenceScenariosKey).toBe("/api/independence/scenarios")
    expect(lifestyleCatalogKey()).toBe("/api/independence/lifestyle-catalog")
    expect(lifestyleCatalogKey("S D")).toBe(
      "/api/independence/lifestyle-catalog?currency=S%20D",
    )
    expect(projectionKey("p1")).toBe("/api/independence/projection/p1")
    expect(monteCarloUrl("p1")).toBe(
      "/api/independence/projection/p1/monte-carlo",
    )
    expect(definedContributionKey(5000, 40)).toBe(
      "/api/independence/projection/defined-contribution?salary=5000&age=40",
    )
    expect(cpfContributionPreviewKey(6250, 45)).toBe(
      "/api/independence/cpf/contribution-preview?monthlySalary=6250&age=45",
    )
    expect(cpfBalanceSeriesUrl).toBe("/api/independence/cpf/balance-series")
    expect(cpfPolicyBalanceSeriesUrl).toBe(
      "/api/independence/cpf/policy-balance-series",
    )
    expect(compositeProjectionUrl).toBe(
      "/api/independence/composite/projection",
    )
    expect(compositeScenariosUrl).toBe("/api/independence/composite/scenarios")
    expect(compositeMonteCarloUrl).toBe(
      "/api/independence/composite/monte-carlo",
    )
    expect(lumpSumProjectionUrl).toBe("/api/projection/lump-sum")
  })
})

describe("independence api requests", () => {
  it("copies a plan under a new name", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await copyPlan("p1", "Copy")
    expect(fetchMock).toHaveBeenCalledWith("/api/independence/plans/p1/copy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Copy"}',
    })
  })

  it("marks a plan primary with a bare POST", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 409 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await setPrimaryPlan("p1")
    expect(res.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/independence/plans/p1/primary",
      { method: "POST" },
    )
  })

  it("encodes the asset id of a property to remove", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await deletePlanProperty("p1", "a/b")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/independence/plans/p1/properties/a%2Fb",
      { method: "DELETE" },
    )
  })

  it("passes an abort signal through on settings updates", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    const signal = new AbortController().signal
    await updateIndependenceSettings({ yearOfBirth: 1980 }, signal)
    expect(fetchMock).toHaveBeenCalledWith("/api/independence/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"yearOfBirth":1980}',
      signal,
    })
  })
})
