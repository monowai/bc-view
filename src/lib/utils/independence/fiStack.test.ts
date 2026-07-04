import { deriveFiStack } from "./fiStack"

describe("deriveFiStack", () => {
  it("splits liquid and guaranteed-income segments over the same denominator", () => {
    // NZD Live In: portfolio 82.45%, with SS 105.63% -> income segment ~23.18.
    const s = deriveFiStack({
      fiProgress: 82.45,
      retirementAgeFiProgress: 105.63,
    })
    expect(s.hasIncome).toBe(true)
    expect(s.liquidPct).toBeCloseTo(82.45, 2)
    // segment stacks up to the 100 edge: 100 - 82.45
    expect(s.incomePct).toBeCloseTo(17.55, 2)
    // total is unclamped for the label (overflow shown)
    expect(s.totalProgress).toBeCloseTo(105.63, 2)
    expect(s.achieved).toBe(true)
  })

  it("stacks the full income contribution when the total stays under 100", () => {
    // portfolio 40%, with income 65% -> income segment 25.
    const s = deriveFiStack({ fiProgress: 40, retirementAgeFiProgress: 65 })
    expect(s.liquidPct).toBe(40)
    expect(s.incomePct).toBe(25)
    expect(s.totalProgress).toBe(65)
    expect(s.achieved).toBe(false)
  })

  it("shows no income segment when there is no guaranteed income", () => {
    const s = deriveFiStack({
      fiProgress: 82.45,
      retirementAgeFiProgress: null,
    })
    expect(s.hasIncome).toBe(false)
    expect(s.incomePct).toBe(0)
    expect(s.totalProgress).toBe(82.45)
  })

  it("shows no income segment when guaranteed income does not raise progress", () => {
    // retirementAgeFi <= fiProgress (e.g. no PV credit) -> single-segment bar.
    const s = deriveFiStack({ fiProgress: 90, retirementAgeFiProgress: 90 })
    expect(s.hasIncome).toBe(false)
    expect(s.incomePct).toBe(0)
  })

  it("clamps the liquid segment at 100 when the portfolio alone is already FI", () => {
    const s = deriveFiStack({
      fiProgress: 130,
      retirementAgeFiProgress: 150,
    })
    expect(s.liquidPct).toBe(100)
    expect(s.incomePct).toBe(0)
    expect(s.totalProgress).toBe(150)
    expect(s.achieved).toBe(true)
  })
})
