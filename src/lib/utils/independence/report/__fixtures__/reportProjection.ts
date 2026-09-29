import type { RetirementProjection } from "types/independence"

/**
 * Golden projection fixture for the Independence report builder. Synthetic
 * numbers, shaped like a real svc-retire echo: accumulation 52→59, retirement
 * 60→90, property sold at 72, CPF LIFE from 65, peak total wealth at 66.
 */
export function makeReportProjection(
  overrides: Partial<RetirementProjection> = {},
): RetirementProjection {
  const accumulationProjections = Array.from({ length: 8 }, (_, i) => {
    const age = 52 + i
    const endingBalance = 1_300_000 + i * 100_000
    return {
      year: 2026 + i,
      age,
      startingBalance: endingBalance - 100_000,
      contribution: 72_000,
      investmentGrowth: 28_000,
      endingBalance,
      nonSpendableValue: 1_050_000,
      housingValue: 1_050_000,
      totalWealth: endingBalance + 1_050_000,
      currency: "SGD",
    }
  })
  const yearlyProjections = Array.from({ length: 31 }, (_, i) => {
    const age = 60 + i
    const house = age < 72 ? 1_050_000 : 0
    const annuity = age >= 65 ? 336_000 : 0
    // Peak total wealth lands on age 66 by construction.
    const liquid =
      age <= 66
        ? 2_100_000 + (age - 60) * 130_000
        : 2_880_000 - (age - 66) * 40_000
    const endingBalance = Math.max(0, liquid)
    return {
      year: 2034 + i,
      age,
      startingBalance: endingBalance,
      investment: 60_000,
      withdrawals: 90_000,
      endingBalance,
      inflationAdjustedExpenses: 100_800,
      currency: "SGD",
      nonSpendableValue: house + annuity,
      housingValue: house,
      annuitizedValue: annuity,
      totalWealth: endingBalance + house + annuity,
      propertyLiquidated: age >= 72,
      incomeBreakdown: {
        investmentReturns: 60_000,
        pension: 0,
        socialSecurity: 0,
        otherIncome: 12_000,
        rentalIncome: 0,
        totalIncome: 72_000,
      },
    }
  })
  return {
    planId: "plan-1",
    asOfDate: "2026-09-28",
    totalAssets: 2_900_000,
    liquidAssets: 1_300_000,
    monthlyExpenses: 8_400,
    runwayMonths: 456,
    runwayYears: 38,
    depletionAge: undefined,
    currency: "SGD",
    planCurrency: "SGD",
    yearlyProjections,
    accumulationProjections,
    preRetirementAccumulation: {
      liquidAssetsAtRetirement: 2_100_000,
    },
    nonSpendableAtRetirement: 1_050_000,
    housingReturnRate: 0.02,
    liquidBalanceAtLiquidation: 980_000,
    liquidationAge: 72,
    liquidationThresholdPercent: 25,
    fiMetrics: {
      fiNumber: 2_520_000,
      fiProgress: 58,
      gapToFi: 1_220_000,
      netMonthlyExpenses: 8_400,
      totalMonthlyIncome: 1_000,
      isCoastFire: false,
      isFinanciallyIndependent: false,
      retirementAgeFiProgress: 87,
    },
    fiAchievementAge: 62,
    cpfLifeAge: 65,
    sustainableMonthlyExpense: 9_400,
    expenseAdjustment: 1_000,
    expenseAdjustmentPercent: 12,
    effectiveStrategy: "HYBRID",
    primaryStrategy: "HYBRID",
    valueBasis: { balanceBasis: "TODAY", incomeStreams: [] },
    planInputs: {
      monthlyExpenses: 8_400,
      pensionMonthly: 0,
      socialSecurityMonthly: 0,
      otherIncomeMonthly: 1_000,
      rentalIncomeMonthly: 0,
      workingIncomeMonthly: 12_000,
      monthlyContribution: 6_000,
      inflationRate: 0.025,
      blendedReturnRate: 0.055,
      currentAge: 52,
      lifeExpectancy: 90,
      retirementAge: 60,
    },
    findings: [
      {
        code: "ON_TRACK",
        severity: "POSITIVE",
        title: "On track for independence at 60",
        detail:
          "Projected liquid wealth at 60 covers planned spending to age 90.",
      },
      {
        code: "HORIZON_EXCEEDS_FIRE_WINDOW",
        severity: "WARNING",
        title: "Horizon longer than a 4% rule supports",
        detail:
          "A 30-year window is the basis of the 4% rule; yours is 38 years.",
      },
    ],
    warnings: [],
    ...overrides,
  } as RetirementProjection
}
