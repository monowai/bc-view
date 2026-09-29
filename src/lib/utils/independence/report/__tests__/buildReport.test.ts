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

  it("should treat an unresolved strategy as FIRE and leave findings untagged", () => {
    const projection = makeReportProjection()
    projection.effectiveStrategy = undefined
    projection.primaryStrategy = undefined
    const report = buildReport({
      plan,
      projection,
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(report.insights.findings.some((f) => f.tag)).toBe(false)
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

describe("buildReport with JSON nulls from svc-retire", () => {
  // The wire format carries `null`, not `undefined`, for absent optionals.
  const nulled = makeReportProjection({
    fiAchievementAge: null as unknown as undefined,
    cpfLifeAge: null as unknown as undefined,
    liquidationAge: null as unknown as undefined,
  })

  it("should fall back to the no-age standing sentence when fiAchievementAge is null", () => {
    const model = buildReport({
      plan,
      projection: nulled,
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(model.standing.sentence).not.toContain("null")
    expect(model.standing.sentence).toContain("independence number")
  })

  it("should omit milestones whose age is null", () => {
    const model = buildReport({
      plan,
      projection: nulled,
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(model.journey.milestones.join(" ")).not.toContain("null")
    expect(
      model.journey.milestones.some((m) => m.startsWith("Peak wealth")),
    ).toBe(true)
  })
})

describe("buildReport shortfall guard", () => {
  it("should clamp shortfall years at zero when depletion lands past the horizon", () => {
    const model = buildReport({
      plan,
      projection: makeReportProjection({ depletionAge: 95 }),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(model.verdict.sentence).toContain("runs short at age 95, 0 years")
    expect(model.verdict.sentence).not.toContain("-5")
  })
})

describe("buildReport sign handling", () => {
  it("should floor a negative fiProgress at 0% in the standing sentence", () => {
    const projection = makeReportProjection()
    projection.fiMetrics = { ...projection.fiMetrics!, fiProgress: -12 }
    const model = buildReport({
      plan,
      projection,
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(model.standing.sentence).toContain("You have 0% of")
    expect(model.standing.sentence).not.toContain("-12%")
  })

  it("should say above plan when a shortfall carries a positive adjustment", () => {
    const model = buildReport({
      plan,
      projection: makeReportProjection({
        depletionAge: 84,
        expenseAdjustmentPercent: 5,
      }),
      mc: null,
      ages,
      currencySymbol: "S$",
    })
    expect(model.verdict.sentence).toContain("5% above plan")
  })
})
