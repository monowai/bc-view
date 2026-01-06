import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  RetirementPlan,
  RetirementProjection,
  YearlyProjection,
  ProjectionResponse,
} from "types/retirement"
import { WhatIfAdjustments, ScenarioOverrides } from "./types"

// Rental income by currency from RE asset configs
export interface RentalIncomeData {
  monthlyNetByCurrency: Record<string, number> // currency -> net monthly rental
  totalMonthlyInPlanCurrency: number // converted to plan currency
}

interface UseRetirementProjectionProps {
  plan: RetirementPlan | undefined
  liquidAssets: number
  nonSpendableAssets: number
  selectedPortfolioIds: string[]
  currentAge: number | undefined
  retirementAge: number
  lifeExpectancy: number
  monthlyInvestment: number
  blendedReturnRate: number
  planCurrency: string
  whatIfAdjustments: WhatIfAdjustments
  scenarioOverrides: ScenarioOverrides
  spendableCategories: string[]
  rentalIncome?: RentalIncomeData // Optional rental income from RE assets
}

interface UseRetirementProjectionResult {
  projection: RetirementProjection | null
  adjustedProjection: RetirementProjection | null
  isCalculating: boolean
  calculateProjection: () => Promise<void>
  resetProjection: () => void
}

export function useRetirementProjection({
  plan,
  liquidAssets,
  nonSpendableAssets,
  selectedPortfolioIds,
  currentAge,
  retirementAge,
  lifeExpectancy,
  monthlyInvestment,
  blendedReturnRate,
  planCurrency,
  whatIfAdjustments,
  scenarioOverrides,
  spendableCategories,
  rentalIncome,
}: UseRetirementProjectionProps): UseRetirementProjectionResult {
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [isCalculating, setIsCalculating] = useState(false)
  const hasAutoCalculated = useRef(false)

  const calculateProjection = useCallback(async (): Promise<void> => {
    if (!plan || liquidAssets === 0) return

    setIsCalculating(true)
    try {
      const response = await fetch(`/api/retire/projection/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liquidAssets,
          nonSpendableAssets,
          portfolioIds: selectedPortfolioIds,
          currency: plan.expensesCurrency,
          currentAge,
          retirementAge,
          lifeExpectancy,
          monthlyContribution: monthlyInvestment,
        }),
      })

      if (response.ok) {
        const result: ProjectionResponse = await response.json()
        setProjection(result.data)
      }
    } catch (err) {
      console.error("Failed to calculate projection:", err)
    } finally {
      setIsCalculating(false)
    }
  }, [
    plan,
    liquidAssets,
    nonSpendableAssets,
    selectedPortfolioIds,
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
  ])

  // Auto-calculate projection when data is ready
  useEffect(() => {
    if (
      plan &&
      liquidAssets > 0 &&
      spendableCategories.length > 0 &&
      !hasAutoCalculated.current &&
      !projection
    ) {
      hasAutoCalculated.current = true
      calculateProjection()
    }
  }, [plan, liquidAssets, spendableCategories, projection, calculateProjection])

  // Reset projection when categories change
  const resetProjection = useCallback((): void => {
    setProjection(null)
    hasAutoCalculated.current = false
  }, [])

  // Apply What-If adjustments to projection
  const adjustedProjection = useMemo((): RetirementProjection | null => {
    if (!projection || !plan) return projection

    const {
      retirementAgeOffset,
      expensesPercent,
      returnRateOffset,
      inflationOffset,
      contributionPercent,
    } = whatIfAdjustments

    // Use in-memory state (scenarioOverrides) with plan as fallback
    const effectiveMonthlyExpenses =
      scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses
    const effectiveLifeExpectancy = lifeExpectancy
    const effectivePensionMonthly =
      scenarioOverrides.pensionMonthly ?? plan.pensionMonthly
    const effectiveSocialSecurityMonthly =
      scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly
    const effectiveOtherIncomeMonthly =
      scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly
    const effectiveInflationRate =
      scenarioOverrides.inflationRate ?? plan.inflationRate
    const effectiveEquityReturnRate =
      scenarioOverrides.equityReturnRate ?? plan.equityReturnRate
    const effectiveCashReturnRate =
      scenarioOverrides.cashReturnRate ?? plan.cashReturnRate
    const effectiveHousingReturnRate =
      scenarioOverrides.housingReturnRate ?? plan.housingReturnRate

    // Retirement age: calculate from slider offset
    const effectiveRetirementAge = retirementAge + retirementAgeOffset

    // Always recalculate to ensure full timeline to life expectancy
    const baseExpenses = effectiveMonthlyExpenses * 12 * (expensesPercent / 100)

    // Calculate return rate based on equity/cash allocation
    // If equityPercent is set, recalculate blended rate using that allocation
    // NOTE: Blended rate is for INVESTABLE assets only (cash + equity), not housing
    // Housing appreciates separately at housingReturnRate in the yearly loop
    let baseReturnRate = blendedReturnRate
    if (whatIfAdjustments.equityPercent !== null) {
      const equityPct = whatIfAdjustments.equityPercent / 100
      const cashPct = 1 - equityPct
      // Blended rate = weighted average of equity and cash returns only
      // This matches backend: (equityWeight * equityRate) + (cashWeight * cashRate)
      baseReturnRate =
        effectiveEquityReturnRate * equityPct +
        effectiveCashReturnRate * cashPct
    }
    const adjustedReturnRate = baseReturnRate + returnRateOffset / 100
    const adjustedInflation = effectiveInflationRate + inflationOffset / 100

    // Calculate adjusted contribution amount
    const adjustedMonthlyInvestment =
      monthlyInvestment * (contributionPercent / 100)
    const baseAnnualContribution = monthlyInvestment * 12
    const adjustedAnnualContribution = adjustedMonthlyInvestment * 12

    // Calculate additional accumulation based on contribution changes and retirement age
    let adjustedLiquidAssets = projection.liquidAssets
    let adjustedNonSpendable = projection.nonSpendableAtRetirement

    // If contribution % changed, adjust for the difference over the pre-retirement period
    // This approximates what the balance would be with different contribution levels
    if (contributionPercent !== 100 && projection.preRetirementAccumulation) {
      const yearsToRetirement =
        projection.preRetirementAccumulation.yearsToRetirement
      if (yearsToRetirement > 0) {
        // Difference in annual contribution
        const contributionDiff =
          adjustedAnnualContribution - baseAnnualContribution
        // Future value of the contribution difference (simplified compound growth)
        let additionalValue = 0
        for (let y = 0; y < yearsToRetirement; y++) {
          additionalValue =
            (additionalValue + contributionDiff) * (1 + baseReturnRate)
        }
        adjustedLiquidAssets += additionalValue
      }
    }

    // Calculate years difference from base retirement age
    const retirementAgeDiff = effectiveRetirementAge - retirementAge
    if (retirementAgeDiff !== 0) {
      if (retirementAgeDiff > 0) {
        // Working longer: add contributions at start of year, then apply growth
        // This matches standard financial practice (beginning-of-period contributions)
        for (let y = 0; y < retirementAgeDiff; y++) {
          // Add year's contributions first, then apply growth for the year
          adjustedLiquidAssets =
            (adjustedLiquidAssets + adjustedAnnualContribution) *
            (1 + baseReturnRate)
          // Non-spendable assets also grow
          adjustedNonSpendable =
            adjustedNonSpendable * (1 + effectiveHousingReturnRate)
        }
      } else {
        // Retiring earlier: reverse compound (approximate)
        // Reverse the beginning-of-period contribution logic
        for (let y = 0; y < Math.abs(retirementAgeDiff); y++) {
          // Reverse growth first, then remove contribution
          adjustedLiquidAssets =
            adjustedLiquidAssets / (1 + baseReturnRate) -
            adjustedAnnualContribution
          adjustedNonSpendable =
            adjustedNonSpendable / (1 + effectiveHousingReturnRate)
        }
        // Ensure we don't go negative
        adjustedLiquidAssets = Math.max(0, adjustedLiquidAssets)
        adjustedNonSpendable = Math.max(0, adjustedNonSpendable)
      }
    }

    // Calculate adjusted yearly projections
    const adjustedYearlyProjections: YearlyProjection[] = []
    let balance = adjustedLiquidAssets
    let nonSpendable = adjustedNonSpendable
    let expenses = baseExpenses

    // Calculate from retirement age to life expectancy (show full timeline)
    const yearsInRetirement = effectiveLifeExpectancy - effectiveRetirementAge
    const initialLiquidAssets = adjustedLiquidAssets
    const liquidationThreshold = whatIfAdjustments.liquidationThreshold / 100 // Convert from %
    let hasLiquidatedProperty = false
    let propertyLiquidationAge: number | undefined
    let liquidBalanceAtLiquidation: number | undefined

    // Base annual income amounts (will be inflation-adjusted where appropriate)
    const basePensionAnnual = effectivePensionMonthly * 12
    const baseSocialSecurityAnnual = effectiveSocialSecurityMonthly * 12
    const baseOtherIncomeAnnual = effectiveOtherIncomeMonthly * 12
    // Rental income from RE assets (converted to plan currency, net of management fees)
    const baseRentalIncomeAnnual =
      (rentalIncome?.totalMonthlyInPlanCurrency || 0) * 12

    for (let i = 0; i <= yearsInRetirement; i++) {
      const age = effectiveRetirementAge + i

      // Check if we should liquidate non-spendable assets (property)
      // Trigger when liquid assets fall below threshold % of initial and we haven't already sold
      if (
        !hasLiquidatedProperty &&
        nonSpendable > 0 &&
        balance < initialLiquidAssets * liquidationThreshold &&
        balance > 0
      ) {
        // Record liquid balance at the point of liquidation (before adding property proceeds)
        liquidBalanceAtLiquidation = balance
        // Sell property - add proceeds to liquid assets
        balance += nonSpendable
        nonSpendable = 0
        hasLiquidatedProperty = true
        propertyLiquidationAge = age
      }

      const startingBalance = Math.max(0, balance)
      const investment = startingBalance * adjustedReturnRate

      // Calculate inflation-adjusted income
      // NZ Super (social security) IS inflation-indexed by law
      // Private pensions typically are NOT inflation-indexed
      // Other income and rental typically NOT indexed (no assumption of rent growth)
      const inflationFactor = Math.pow(1 + adjustedInflation, i)
      const socialSecurityIncome = baseSocialSecurityAnnual * inflationFactor
      const pensionIncome = basePensionAnnual // Not inflation-indexed
      const otherIncome = baseOtherIncomeAnnual // Not indexed
      // Rental income stops when property is liquidated
      const propertyRentalIncome = hasLiquidatedProperty
        ? 0
        : baseRentalIncomeAnnual

      const totalPassiveIncome =
        pensionIncome +
        socialSecurityIncome +
        otherIncome +
        propertyRentalIncome
      const withdrawals =
        balance > 0 ? Math.max(0, expenses - totalPassiveIncome) : 0

      balance = balance + investment - withdrawals
      if (!hasLiquidatedProperty) {
        nonSpendable = nonSpendable * (1 + effectiveHousingReturnRate)
      }
      expenses = expenses * (1 + adjustedInflation)

      adjustedYearlyProjections.push({
        year: i + 1,
        age,
        startingBalance,
        investment,
        withdrawals,
        endingBalance: Math.max(0, balance),
        inflationAdjustedExpenses: expenses,
        currency: planCurrency,
        nonSpendableValue: nonSpendable,
        totalWealth: Math.max(0, balance) + nonSpendable,
        propertyLiquidated:
          hasLiquidatedProperty && age === propertyLiquidationAge,
        incomeBreakdown: {
          investmentReturns: investment,
          pension: pensionIncome,
          socialSecurity: socialSecurityIncome,
          otherIncome: otherIncome,
          rentalIncome: propertyRentalIncome,
          totalIncome: investment + totalPassiveIncome,
        },
      })
    }

    // Calculate adjusted runway
    const depletionYear = adjustedYearlyProjections.findIndex(
      (y) => y.endingBalance <= 0,
    )
    const runwayYears =
      depletionYear >= 0 ? depletionYear + 1 : adjustedYearlyProjections.length
    const depletionAge =
      depletionYear >= 0
        ? effectiveRetirementAge + depletionYear + 1
        : undefined

    return {
      ...projection,
      yearlyProjections: adjustedYearlyProjections,
      runwayYears,
      runwayMonths: runwayYears * 12,
      depletionAge,
      liquidBalanceAtLiquidation,
      liquidationThresholdPercent: whatIfAdjustments.liquidationThreshold,
    }
  }, [
    projection,
    plan,
    whatIfAdjustments,
    scenarioOverrides,
    retirementAge,
    lifeExpectancy,
    planCurrency,
    monthlyInvestment,
    blendedReturnRate,
    rentalIncome,
  ])

  return {
    projection,
    adjustedProjection,
    isCalculating,
    calculateProjection,
    resetProjection,
  }
}
