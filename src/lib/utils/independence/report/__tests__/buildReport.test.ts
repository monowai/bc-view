import { buildReport } from "@lib/independence/report/buildReport"
import { makeReportProjection } from "@lib/independence/report/__fixtures__/reportProjection"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import type { RetirementPlan } from "types/independence"

const plan = {
  id: "plan-1",
  name: "Base plan",
  expensesCurrency: "SGD",
} as RetirementPlan
const ages = { currentAge: 52, retirementAge: 60, lifeExpectancy: 90 }

describe("buildReport", () => {
  it("should be a pure function of its inputs", () => {
    const a = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: fixtureMonteCarloResult,
      ages,
      currencySymbol: "S$",
    })
    const b = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: fixtureMonteCarloResult,
      ages,
      currencySymbol: "S$",
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("should take the headline from the first finding", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(report.verdict.headline).toBe("On track for independence at 60")
  })

  it("should use the funded verdict when there is no depletion age", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection({ depletionAge: undefined }),
      mc: fixtureMonteCarloResult,
      ages,
      currencySymbol: "S$",
    })
    expect(report.verdict.sentence).toContain("funds every year to age 90")
  })

  it("should use the shortfall verdict when the plan depletes", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection({
        depletionAge: 84,
        sustainableMonthlyExpense: 7900,
        expenseAdjustmentPercent: -6,
      }),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(report.verdict.sentence).toBe(
      "Your plan runs short at age 84, 6 years before age 90. Sustainable spending is S$7,900 a month, 6% below plan.",
    )
  })

  it("should omit the stress-test sentence when there is no simulation", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(report.stress).toBeNull()
  })

  it("should list milestones in fixed order and skip absent ones", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection({
        fiAchievementAge: 60,
        cpfLifeAge: 65,
        liquidationAge: undefined,
      }),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(report.journey.milestones).toEqual([
      "Independence at age 60.",
      "CPF LIFE payouts start at age 65.",
      "Peak wealth S$4,266,000 at age 66.",
    ])
  })

  it("should tag FIRE-lens findings when the strategy is not FIRE", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    const fire = report.insights.findings.find(
      (f) => f.code === "HORIZON_EXCEEDS_FIRE_WINDOW",
    )
    expect(fire?.tag).toBe("FIRE lens")
    const onTrack = report.insights.findings.find((f) => f.code === "ON_TRACK")
    expect(onTrack?.tag).toBeUndefined()
  })

  it("should match the golden snapshot", () => {
    const report = buildReport({
      plan,
      projection: makeReportProjection(),
      mc: fixtureMonteCarloResult,
      ages,
      currencySymbol: "S$",
      seed: 4213,
    })
    expect(report).toMatchSnapshot()
  })
})
