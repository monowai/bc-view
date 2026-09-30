import type {
  CompositeProjectionResult,
  CompositeYearlyProjection,
} from "types/independence"

/**
 * Golden composite fixture for the journey report builder. Synthetic numbers,
 * shaped like a svc-retire composite echo: accumulation 52→59, then three
 * stages — Singapore 60→69, New Zealand 70→79, Thailand 80→90.
 */
const STAGES = [
  {
    planId: "p-sg",
    planName: "Singapore",
    fromAge: 60,
    toAge: 69,
    spend: 84_000,
  },
  {
    planId: "p-nz",
    planName: "New Zealand",
    fromAge: 70,
    toAge: 79,
    spend: 72_000,
  },
  {
    planId: "p-th",
    planName: "Thailand",
    fromAge: 80,
    toAge: 90,
    spend: 48_000,
  },
]

function row(
  age: number,
  planId: string,
  planName: string,
  startingBalance: number,
  expenses: number,
): CompositeYearlyProjection {
  const investmentReturns = Math.round(startingBalance * 0.05)
  const endingBalance = startingBalance + investmentReturns - expenses
  return {
    year: 1974 + age,
    age,
    planId,
    planName,
    startingBalance,
    investmentReturns,
    income: 0,
    expenses,
    endingBalance,
    nonSpendableValue: 500_000,
    totalWealth: endingBalance + 500_000,
    currency: "SGD",
  }
}

export function makeJourneyProjection(
  overrides: Partial<CompositeProjectionResult> = {},
): CompositeProjectionResult {
  const accumulationProjections: CompositeYearlyProjection[] = []
  let balance = 1_200_000
  for (let age = 52; age < 60; age++) {
    const r = row(age, "p-sg", "Singapore", balance, 0)
    accumulationProjections.push(r)
    balance = r.endingBalance
  }
  const yearlyProjections: CompositeYearlyProjection[] = []
  for (const s of STAGES) {
    for (let age = s.fromAge; age <= s.toAge; age++) {
      const r = row(age, s.planId, s.planName, balance, s.spend)
      yearlyProjections.push(r)
      balance = r.endingBalance
    }
  }
  return {
    asOfDate: "2026-09-29",
    displayCurrency: "SGD",
    phases: STAGES.map((s) => ({
      planId: s.planId,
      planName: s.planName,
      fromAge: s.fromAge,
      toAge: s.toAge,
      expensesCurrency: "SGD",
      assumptions: {
        source: "STAGE",
        cashReturnRate: 0.02,
        equityReturnRate: 0.06,
        housingReturnRate: 0.03,
        inflationRate: 0.025,
        feeRate: 0.005,
        investmentTaxRate: 0,
      },
    })),
    totalAssets: 1_700_000,
    liquidAssets: 1_200_000,
    runwayYears: 38,
    isSustainable: true,
    yearlyProjections,
    accumulationProjections,
    warnings: [],
    fiNumber: 1_950_000,
    fiProgress: 61.5,
    currentAge: 52,
    ...overrides,
  }
}
