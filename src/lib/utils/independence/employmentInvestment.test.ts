import { employmentInvestment } from "./employmentInvestment"

describe("employmentInvestment", () => {
  it("invests the allocation share of the surplus when there is no defined contribution", () => {
    const result = employmentInvestment({
      surplusAfterContributions: 2000,
      investmentAllocationPercent: 50,
      definedContribution: 0,
    })

    expect(result).toEqual({ monthlyInvestment: 1000, investmentTarget: 1000 })
  })

  it("takes the defined contribution off before the allocation splits the surplus", () => {
    // Gross 6,253 - taxes 150 - expenses 4,000 = 2,103 surplus; CPF employee 1,250.
    // (2,103 - 1,250) x 50% = 426.50, matching svc-retire's projection.
    const result = employmentInvestment({
      surplusAfterContributions: 2103,
      investmentAllocationPercent: 50,
      definedContribution: 1250,
    })

    expect(result.monthlyInvestment).toBeCloseTo(1051.5)
    expect(result.investmentTarget).toBeCloseTo(426.5)
  })

  it("never targets a negative investment", () => {
    const result = employmentInvestment({
      surplusAfterContributions: 800,
      investmentAllocationPercent: 100,
      definedContribution: 1000,
    })

    expect(result.investmentTarget).toBe(0)
  })
})
