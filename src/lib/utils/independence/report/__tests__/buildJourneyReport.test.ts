import { buildJourneyReport } from "@lib/independence/report/buildJourneyReport"
import { makeJourneyProjection } from "@lib/independence/report/__fixtures__/journeyProjection"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"

const base = {
  journeyName: "Slow travel",
  mc: null,
  currencySymbol: "S$",
}

describe("buildJourneyReport", () => {
  it("should be a pure function of its inputs", () => {
    const a = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
      mc: fixtureMonteCarloResult,
      seed: 4213,
    })
    const b = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
      mc: fixtureMonteCarloResult,
      seed: 4213,
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("should read the ages off the journey: current, first stage, last stage", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
    })
    expect(report.cover.ageLine).toBe(
      "Age 52, planning to age 90, independence target age 60",
    )
    expect(report.cover.stageLine).toBe("3 stages")
  })

  it("should list every stage in order with its ages and first-year spending", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
    })
    expect(report.stages.map((s) => [s.planId, s.name, s.ages])).toEqual([
      ["p-sg", "Singapore", "60–69"],
      ["p-nz", "New Zealand", "70–79"],
      ["p-th", "Thailand", "80–90"],
    ])
    expect(report.stages[1].firstYearSpend).toBe("S$72,000")
  })

  it("should print the stage's own ending balance", () => {
    const projection = makeJourneyProjection()
    const lastSg = projection.yearlyProjections.filter(
      (r) => r.planId === "p-sg",
    )
    const report = buildJourneyReport({ ...base, projection })
    expect(report.stages[0].endingBalance).toBe(
      `S$${lastSg[lastSg.length - 1].endingBalance.toLocaleString("en-US")}`,
    )
  })

  it("should say the money lasts when nothing depletes", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
    })
    expect(report.verdict.headline).toBe("Your money lasts to age 90")
    expect(report.verdict.sentence).toBe(
      "Your plan funds every year to age 90.",
    )
  })

  it("should name the depletion age and the years short when the journey runs out", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection({
        depletionAge: 84,
        isSustainable: false,
        runwayYears: 32,
      }),
    })
    expect(report.verdict.headline).toBe("Your money runs out at age 84")
    expect(report.verdict.sentence).toBe(
      "Your journey runs short at age 84, 6 years before age 90.",
    )
    const lasts = report.verdict.kpis.find(
      (k) => k.label === "Money lasts until",
    )
    expect(lasts?.value).toBe("84")
    expect(lasts?.caption).toBe("32 years runway")
  })

  it("should compare the ending balance with the target when the journey has one", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection({
        targetBalance: 500_000,
        surplusOrDeficit: -120_000,
      }),
    })
    const kpi = report.verdict.kpis[2]
    expect(kpi.label).toBe("Ending balance vs target")
    expect(kpi.value).toBe("-S$120k")
    expect(kpi.caption).toBe("target S$500,000")
  })

  it("should report FI progress clamped at zero", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection({ fiProgress: -8 }),
    })
    expect(report.standing.sentence).toBe(
      "You have 0% of your independence number of S$1,950,000.",
    )
  })

  it("should carry the seed into the stress test only when a simulation ran", () => {
    const ran = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
      mc: fixtureMonteCarloResult,
      seed: 4213,
    })
    expect(ran.stress?.seed).toBe(4213)
    const notRun = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
      seed: 4213,
    })
    expect(notRun.stress).toBeNull()
  })

  it("should list each stage's return and inflation in the assumptions", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
    })
    expect(report.assumptions).toContainEqual({
      label: "New Zealand",
      value: "equity 6.0%, cash 2.0%, inflation 2.5%",
    })
  })

  it("should translate known warnings and keep unknown ones verbatim", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection({
        warnings: ["NO_EXPENSES", "SOMETHING_NEW"],
      }),
    })
    expect(report.warnings).toEqual([
      "No expenses are recorded; the plan's monthly figure was used.",
      "SOMETHING_NEW",
    ])
  })

  it("should tolerate JSON nulls from svc-retire", () => {
    const projection = makeJourneyProjection()
    const nulled = {
      ...projection,
      depletionAge: null,
      targetBalance: null,
      fiProgress: null,
      currentAge: null,
    } as unknown as typeof projection
    const report = buildJourneyReport({ ...base, projection: nulled })
    expect(report.verdict.headline).toBe("Your money lasts to age 90")
    expect(report.standing.sentence).toBeNull()
    expect(report.cover.ageLine).toContain("Age —")
  })

  it("should match the golden snapshot", () => {
    const report = buildJourneyReport({
      ...base,
      projection: makeJourneyProjection(),
      mc: fixtureMonteCarloResult,
      seed: 4213,
    })
    expect(report).toMatchSnapshot()
  })
})
