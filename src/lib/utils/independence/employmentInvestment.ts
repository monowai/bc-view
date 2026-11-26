export interface EmploymentInvestmentInput {
  /** Monthly surplus after expenses, taxes and pension contributions. */
  surplusAfterContributions: number
  /** Share of the surplus the owner invests, 0-100. */
  investmentAllocationPercent: number
  /** Monthly employee defined contribution (e.g. CPF) taken from gross pay. */
  definedContribution: number
}

export interface EmploymentInvestment {
  /** Allocation share of the surplus, before any defined contribution. */
  monthlyInvestment: number
  /** What is left to invest once the defined contribution has left pay. */
  investmentTarget: number
}

/**
 * The wizard's monthly investment figures. The employee defined contribution
 * is compulsory, so it shrinks the surplus BEFORE the allocation splits it,
 * the same order svc-retire's projection uses (svc-retire #338).
 */
export function employmentInvestment({
  surplusAfterContributions,
  investmentAllocationPercent,
  definedContribution,
}: EmploymentInvestmentInput): EmploymentInvestment {
  const share = investmentAllocationPercent / 100
  return {
    monthlyInvestment: Math.max(0, surplusAfterContributions * share),
    investmentTarget: Math.max(
      0,
      (surplusAfterContributions - definedContribution) * share,
    ),
  }
}
