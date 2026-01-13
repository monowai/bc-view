import React, { useState, useMemo, useEffect, useRef } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import useSwr, { mutate } from "swr"
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts"
import InfoTooltip from "@components/ui/Tooltip"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import {
  PlanResponse,
  QuickScenario,
  QuickScenariosResponse,
} from "types/independence"
import { Portfolio, HoldingContract, FxResponse } from "types/beancounter"
import {
  transformToAllocationSlices,
  AllocationSlice,
} from "@lib/allocation/aggregateHoldings"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  WhatIfAdjustments,
  ScenarioOverrides,
  TabId,
  TABS,
  DEFAULT_NON_SPENDABLE,
  DEFAULT_WHAT_IF_ADJUSTMENTS,
  hasScenarioChanges,
  useRetirementProjection,
  RentalIncomeData,
  WhatIfModal,
  ScenarioImpact,
  SaveScenarioDialog,
  EditPlanDetailsModal,
  IncomeBreakdownTable,
  FiMetrics,
  FiSummaryBar,
} from "@components/features/independence"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

interface PortfoliosResponse {
  data: Portfolio[]
}

function PlanView(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { id } = router.query
  const { hideValues } = usePrivacyMode()
  const hasAutoSelected = useRef(false)
  const hasCategoriesInitialized = useRef(false)
  const [activeTab, setActiveTab] = useState<TabId>("details")
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([])
  const [spendableCategories, setSpendableCategories] = useState<string[]>([])

  // What-If state
  const [whatIfAdjustments, setWhatIfAdjustments] = useState<WhatIfAdjustments>(
    DEFAULT_WHAT_IF_ADJUSTMENTS,
  )

  // Selected quick scenarios (can select multiple)
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Scenario overrides - holds edited values until user decides to save
  const [scenarioOverrides, setScenarioOverrides] = useState<ScenarioOverrides>(
    {},
  )

  // Edit details modal state
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false)
  const [showWhatIfModal, setShowWhatIfModal] = useState(false)

  const { data: planData, error: planError } = useSwr<PlanResponse>(
    id ? `/api/independence/plans/${id}` : null,
    id ? simpleFetcher(`/api/independence/plans/${id}`) : null,
  )

  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Fetch aggregated holdings to get category breakdown
  const { data: holdingsResponse } = useSwr<{ data: HoldingContract }>(
    "/api/holdings/aggregated?asAt=today",
    simpleFetcher("/api/holdings/aggregated?asAt=today"),
  )
  const holdingsData = holdingsResponse?.data
  const holdingsCurrency = holdingsData?.portfolio?.currency?.code

  // Fetch quick scenarios for What-If analysis
  const { data: scenariosData } = useSwr<QuickScenariosResponse>(
    "/api/independence/scenarios",
    simpleFetcher("/api/independence/scenarios"),
  )
  const quickScenarios = useMemo(
    () => scenariosData?.data || [],
    [scenariosData?.data],
  )

  // Fetch rental income from RE asset configs
  const { configs: assetConfigs, getNetRentalByCurrency } =
    usePrivateAssetConfigs()

  const plan = planData?.data
  const planCurrency = plan?.expensesCurrency || "NZD"

  // Display currency conversion (all plan values are in planCurrency)
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null)
  const [fxRate, setFxRate] = useState<number>(1)
  const [fxRateLoaded, setFxRateLoaded] = useState<boolean>(true) // true when no conversion needed
  // Only use display currency when fxRate has been loaded to avoid showing wrong values
  const effectiveCurrency =
    displayCurrency && fxRateLoaded ? displayCurrency : planCurrency
  const effectiveFxRate =
    displayCurrency && fxRateLoaded && displayCurrency !== planCurrency
      ? fxRate
      : 1

  // Fetch available currencies
  const { data: currenciesData } = useSwr<{
    data: { code: string; name: string; symbol: string }[]
  }>("/api/currencies", simpleFetcher("/api/currencies"))
  const availableCurrencies = currenciesData?.data || []

  // Fetch FX rate when display currency changes
  useEffect(() => {
    const fetchFxRate = async (): Promise<void> => {
      if (!displayCurrency || displayCurrency === planCurrency) {
        setFxRate(1)
        setFxRateLoaded(true)
        return
      }
      // Mark as loading while fetching
      setFxRateLoaded(false)
      try {
        const response = await fetch("/api/fx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rateDate: "today",
            pairs: [{ from: planCurrency, to: displayCurrency }],
          }),
        })
        const fxResponse: FxResponse = await response.json()
        const rateKey = `${planCurrency}:${displayCurrency}`
        const rate = fxResponse.data?.rates?.[rateKey]?.rate
        if (rate && rate !== 1) {
          setFxRate(rate)
          setFxRateLoaded(true)
        } else {
          // Rate not found or is 1 - stay in plan currency
          console.warn(`FX rate not found for ${rateKey}, using plan currency`)
          setFxRate(1)
          setFxRateLoaded(false) // Keep showing plan currency
        }
      } catch (err) {
        console.error("Failed to fetch FX rate:", err)
        setFxRate(1)
        setFxRateLoaded(false) // Keep showing plan currency on error
      }
    }
    fetchFxRate()
  }, [planCurrency, displayCurrency])

  // FX rate to convert holdings from portfolio currency to plan currency
  const [holdingsToPlanRate, setHoldingsToPlanRate] = useState<number>(1)

  useEffect(() => {
    const fetchHoldingsFxRate = async (): Promise<void> => {
      if (
        !holdingsCurrency ||
        !planCurrency ||
        holdingsCurrency === planCurrency
      ) {
        setHoldingsToPlanRate(1)
        return
      }
      try {
        const response = await fetch("/api/fx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rateDate: "today",
            pairs: [{ from: holdingsCurrency, to: planCurrency }],
          }),
        })
        const fxResponse: FxResponse = await response.json()
        const rateKey = `${holdingsCurrency}:${planCurrency}`
        setHoldingsToPlanRate(fxResponse.data?.rates?.[rateKey]?.rate || 1)
      } catch (err) {
        console.error("Failed to fetch holdings FX rate:", err)
        setHoldingsToPlanRate(1)
      }
    }
    fetchHoldingsFxRate()
  }, [holdingsCurrency, planCurrency])

  // Get raw rental income by currency (not yet converted)
  const monthlyNetByCurrency = useMemo(() => {
    if (!assetConfigs || assetConfigs.length === 0) return {}
    return getNetRentalByCurrency()
  }, [assetConfigs, getNetRentalByCurrency])

  // State for FX-converted rental income
  const [convertedRentalTotal, setConvertedRentalTotal] = useState<number>(0)

  // Fetch FX rates and convert rental income to plan currency
  useEffect(() => {
    const convertRentalIncome = async (): Promise<void> => {
      const currencies = Object.keys(monthlyNetByCurrency)
      if (currencies.length === 0 || !planCurrency) {
        setConvertedRentalTotal(0)
        return
      }

      // Build pairs for currencies that need conversion
      const pairs = currencies
        .filter((currency) => currency !== planCurrency)
        .map((currency) => ({ from: currency, to: planCurrency }))

      const fxRates: Record<string, number> = {}

      if (pairs.length > 0) {
        try {
          const response = await fetch("/api/fx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rateDate: "today", pairs }),
          })
          const fxResponse: FxResponse = await response.json()
          // Extract rates from response (keyed as "FROM:TO")
          if (fxResponse.data?.rates) {
            Object.entries(fxResponse.data.rates).forEach(([key, value]) => {
              fxRates[key] = value.rate
            })
          }
        } catch (err) {
          console.error("Failed to fetch FX rates for rental income:", err)
        }
      }

      // Convert and sum all rental income
      let total = 0
      Object.entries(monthlyNetByCurrency).forEach(([currency, amount]) => {
        if (currency === planCurrency) {
          total += amount
        } else {
          const rateKey = `${currency}:${planCurrency}`
          const rate = fxRates[rateKey] || 1
          total += amount * rate
        }
      })

      setConvertedRentalTotal(total)
    }

    convertRentalIncome()
  }, [monthlyNetByCurrency, planCurrency])

  // Build rental income data for projections
  const rentalIncome = useMemo((): RentalIncomeData | undefined => {
    if (Object.keys(monthlyNetByCurrency).length === 0) return undefined

    return {
      monthlyNetByCurrency,
      totalMonthlyInPlanCurrency: convertedRentalTotal,
    }
  }, [monthlyNetByCurrency, convertedRentalTotal])

  // Filter to only show portfolios with non-zero balance
  const portfolios = useMemo(() => {
    return (portfoliosData?.data || []).filter(
      (p) => p.marketValue && p.marketValue !== 0,
    )
  }, [portfoliosData])

  // Transform holdings into category slices
  const categorySlices = useMemo((): AllocationSlice[] => {
    if (!holdingsData) return []
    return transformToAllocationSlices(
      holdingsData,
      "category",
      ValueIn.PORTFOLIO,
    )
  }, [holdingsData])

  // Auto-select all portfolios when data first loads
  useEffect(() => {
    if (portfolios.length > 0 && !hasAutoSelected.current) {
      const allIds = portfolios.map((p) => p.id)
      setSelectedPortfolioIds(allIds)
      hasAutoSelected.current = true
    }
  }, [portfolios])

  // Initialize spendable categories (all except property by default)
  useEffect(() => {
    if (
      categorySlices.length > 0 &&
      !hasCategoriesInitialized.current &&
      plan
    ) {
      const allCategories = categorySlices.map((s) => s.key)
      const spendable = allCategories.filter(
        (cat) => !DEFAULT_NON_SPENDABLE.includes(cat),
      )
      setSpendableCategories(spendable)
      hasCategoriesInitialized.current = true
    }
  }, [categorySlices, plan])

  // Calculate total assets from category slices (converted to plan currency)
  const totalAssets = useMemo(() => {
    return (
      categorySlices.reduce((sum, slice) => sum + slice.value, 0) *
      holdingsToPlanRate
    )
  }, [categorySlices, holdingsToPlanRate])

  // Calculate liquid (spendable) assets - only selected categories (in plan currency)
  const liquidAssets = useMemo(() => {
    return (
      categorySlices
        .filter((slice) => spendableCategories.includes(slice.key))
        .reduce((sum, slice) => sum + slice.value, 0) * holdingsToPlanRate
    )
  }, [categorySlices, spendableCategories, holdingsToPlanRate])

  // Calculate non-spendable assets (e.g., property) (in plan currency)
  const nonSpendableAssets = useMemo(() => {
    return (
      categorySlices
        .filter((slice) => !spendableCategories.includes(slice.key))
        .reduce((sum, slice) => sum + slice.value, 0) * holdingsToPlanRate
    )
  }, [categorySlices, spendableCategories, holdingsToPlanRate])

  // Default expected return rate for assets without a configured rate (3%)
  const DEFAULT_EXPECTED_RETURN = 0.03

  // Calculate weighted blended return rate from per-asset expected return rates
  const blendedReturnRate = useMemo(() => {
    if (!holdingsData?.positions) {
      // Fall back to plan's allocation-based blended rate
      if (!plan) return DEFAULT_EXPECTED_RETURN
      return (
        plan.equityReturnRate * plan.equityAllocation +
        plan.cashReturnRate * plan.cashAllocation +
        plan.housingReturnRate * plan.housingAllocation
      )
    }

    // Calculate weighted average return based on per-asset rates
    let totalValue = 0
    let weightedSum = 0

    for (const positionKey of Object.keys(holdingsData.positions)) {
      const position = holdingsData.positions[positionKey]
      const moneyValues = position.moneyValues[ValueIn.PORTFOLIO]
      if (!moneyValues) continue

      const marketValue = moneyValues.marketValue || 0
      // Skip non-spendable assets (Property) in blended rate calculation
      const reportCategory =
        position.asset.effectiveReportCategory ||
        position.asset.assetCategory?.name ||
        "Equity"
      if (DEFAULT_NON_SPENDABLE.includes(reportCategory)) continue

      const rate = position.asset.expectedReturnRate ?? DEFAULT_EXPECTED_RETURN
      totalValue += marketValue
      weightedSum += marketValue * rate
    }

    return totalValue > 0 ? weightedSum / totalValue : DEFAULT_EXPECTED_RETURN
  }, [holdingsData, plan])

  // Calculate current age from yearOfBirth
  const currentYear = new Date().getFullYear()
  const currentAge = plan?.yearOfBirth
    ? currentYear - plan.yearOfBirth
    : undefined

  // Use stored lifeExpectancy from plan (default 90)
  const lifeExpectancy = plan?.lifeExpectancy || 90

  // Calculate retirement age: lifeExpectancy - planningHorizon
  const retirementAge = plan?.planningHorizonYears
    ? lifeExpectancy - plan.planningHorizonYears
    : 65

  // Calculate pre-retirement contributions (for passing to backend)
  const monthlySurplus =
    (plan?.workingIncomeMonthly || 0) - (plan?.workingExpensesMonthly || 0)
  const monthlyInvestment =
    monthlySurplus > 0
      ? monthlySurplus * (plan?.investmentAllocationPercent || 0.8)
      : 0

  // Combine What-If adjustments with selected quick scenarios
  const combinedAdjustments = useMemo((): WhatIfAdjustments => {
    if (selectedScenarioIds.length === 0) {
      return whatIfAdjustments
    }

    // Get the selected scenarios
    const selected = quickScenarios.filter((s) =>
      selectedScenarioIds.includes(s.id),
    )

    // Apply each selected scenario using reduce
    return selected.reduce(
      (acc, scenario) => ({
        ...acc,
        // Additive for offsets
        retirementAgeOffset:
          acc.retirementAgeOffset + scenario.retirementAgeOffset,
        returnRateOffset: acc.returnRateOffset + scenario.returnRateOffset,
        inflationOffset: acc.inflationOffset + scenario.inflationOffset,
        // Multiplicative for percentages (e.g., 90% * 110% = 99%)
        expensesPercent: Math.round(
          (acc.expensesPercent * scenario.expensesPercent) / 100,
        ),
        contributionPercent: Math.round(
          (acc.contributionPercent * scenario.contributionPercent) / 100,
        ),
      }),
      { ...whatIfAdjustments },
    )
  }, [whatIfAdjustments, selectedScenarioIds, quickScenarios])

  // Toggle a quick scenario selection
  const toggleScenario = (scenarioId: string): void => {
    setSelectedScenarioIds((prev) =>
      prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId],
    )
  }

  // Use retirement projection hook
  const { adjustedProjection, isCalculating, resetProjection } =
    useRetirementProjection({
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
      whatIfAdjustments: combinedAdjustments,
      scenarioOverrides,
      spendableCategories,
      rentalIncome,
    })

  // Calculate FI metrics for summary bar
  // Prefers backend-provided metrics, falls back to local calculation
  const fiMetrics = useMemo(() => {
    // Use backend fiMetrics when available (from adjustedProjection)
    if (adjustedProjection?.fiMetrics) {
      const backendMetrics = adjustedProjection.fiMetrics
      return {
        fiNumber: backendMetrics.fiNumber,
        netMonthlyExpenses: backendMetrics.netMonthlyExpenses,
        totalMonthlyIncome: backendMetrics.totalMonthlyIncome,
        isCoastFire: backendMetrics.isCoastFire,
        yearsToRetirement:
          currentAge && retirementAge && retirementAge > currentAge
            ? retirementAge - currentAge
            : null,
        fiProgress: backendMetrics.fiProgress,
        savingsRate: backendMetrics.savingsRate,
        yearsToFi: backendMetrics.yearsToFi,
        coastFiNumber: backendMetrics.coastFiNumber,
        coastFiProgress: backendMetrics.coastFiProgress,
        isFinanciallyIndependent: backendMetrics.isFinanciallyIndependent,
      }
    }

    // Fallback: calculate locally when projection not yet loaded
    if (!plan) return null

    // Apply what-if expensesPercent adjustment to gross expenses
    const effectiveGrossExpenses = Math.round(
      plan.monthlyExpenses * (combinedAdjustments.expensesPercent / 100),
    )

    // Calculate income from all sources (pension, benefits, rental, etc.)
    const totalMonthlyIncome =
      (plan.pensionMonthly || 0) +
      (plan.socialSecurityMonthly || 0) +
      (plan.otherIncomeMonthly || 0) +
      (rentalIncome?.totalMonthlyInPlanCurrency || 0)

    // Net expenses = what you actually need from investments
    const netMonthlyExpenses = Math.max(
      0,
      effectiveGrossExpenses - totalMonthlyIncome,
    )

    // FI Number based on NET expenses (accounts for rental income, pension, etc.)
    const annualNetExpenses = netMonthlyExpenses * 12
    const fiNumber = annualNetExpenses * 25

    // Coast FIRE calculation
    const yearsToRetirement =
      currentAge && retirementAge && retirementAge > currentAge
        ? retirementAge - currentAge
        : null
    const coastFiNumber =
      yearsToRetirement && blendedReturnRate > 0
        ? fiNumber / Math.pow(1 + blendedReturnRate, yearsToRetirement)
        : null
    const isCoastFire = coastFiNumber
      ? liquidAssets >= coastFiNumber
      : undefined

    return {
      fiNumber,
      netMonthlyExpenses,
      totalMonthlyIncome,
      isCoastFire,
      yearsToRetirement,
    }
  }, [
    adjustedProjection?.fiMetrics,
    plan,
    combinedAdjustments.expensesPercent,
    rentalIncome?.totalMonthlyInPlanCurrency,
    currentAge,
    retirementAge,
    blendedReturnRate,
    liquidAssets,
  ])

  // Toggle category spendable status
  const toggleCategory = (category: string): void => {
    setSpendableCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    )
    // Reset projection when categories change
    resetProjection()
  }

  const handleExport = async (): Promise<void> => {
    if (!plan) return

    try {
      const response = await fetch(`/api/independence/plans/${plan.id}/export`)
      if (response.ok) {
        const result = await response.json()
        const exportData = result.data

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${plan.name.replace(/[^a-z0-9]/gi, "_")}_retirement_plan.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error("Failed to export plan:", err)
    }
  }

  // Reset what-if adjustments
  const resetWhatIf = (): void => {
    setWhatIfAdjustments(DEFAULT_WHAT_IF_ADJUSTMENTS)
  }

  // Check if there are any scenario changes (from sliders)
  const scenarioHasChanges = hasScenarioChanges(whatIfAdjustments)

  // Apply edited values to local scenario state (not saved to backend yet)
  const handleApplyDetails = (overrides: ScenarioOverrides): void => {
    setScenarioOverrides(overrides)
    setShowEditDetailsModal(false)
  }

  // Check if there are unsaved scenario changes
  const hasScenarioOverrides = Object.keys(scenarioOverrides).length > 0

  // Save scenario to backend (update existing or create new plan)
  const handleSaveScenario = async (
    mode: "update" | "new",
    newPlanName?: string,
  ): Promise<void> => {
    if (!plan) return
    setIsSaving(true)
    try {
      const updates = {
        pensionMonthly: scenarioOverrides.pensionMonthly ?? plan.pensionMonthly,
        socialSecurityMonthly:
          scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly,
        otherIncomeMonthly:
          scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly,
        inflationRate: scenarioOverrides.inflationRate ?? plan.inflationRate,
        targetBalance: scenarioOverrides.targetBalance ?? plan.targetBalance,
      }

      if (mode === "update") {
        // PATCH existing plan
        const response = await fetch(`/api/independence/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (response.ok) {
          mutate(`/api/independence/plans/${id}`)
          setScenarioOverrides({})
          setShowSaveDialog(false)
        }
      } else {
        // POST new plan
        const newPlan = {
          name: newPlanName || `${plan.name} (Scenario)`,
          yearOfBirth: plan.yearOfBirth,
          lifeExpectancy: plan.lifeExpectancy,
          planningHorizonYears: plan.planningHorizonYears,
          monthlyExpenses: plan.monthlyExpenses,
          expensesCurrency: plan.expensesCurrency,
          ...updates,
          workingIncomeMonthly: plan.workingIncomeMonthly,
          workingExpensesMonthly: plan.workingExpensesMonthly,
          investmentAllocationPercent: plan.investmentAllocationPercent,
          cashReturnRate: plan.cashReturnRate,
          equityReturnRate: plan.equityReturnRate,
          housingReturnRate: plan.housingReturnRate,
          cashAllocation: plan.cashAllocation,
          equityAllocation: plan.equityAllocation,
          housingAllocation: plan.housingAllocation,
        }
        const response = await fetch("/api/independence/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPlan),
        })
        if (response.ok) {
          const result = await response.json()
          setScenarioOverrides({})
          setShowSaveDialog(false)
          router.push(`/independence/plans/${result.data.id}`)
        }
      }
    } catch (err) {
      console.error("Failed to save scenario:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // Reset scenario overrides
  const resetScenarioOverrides = (): void => {
    setScenarioOverrides({})
  }

  if (planError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <i className="fas fa-exclamation-circle mr-2"></i>
            Failed to load plan. Please try again.
          </div>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center">
          <i className="fas fa-spinner fa-spin text-3xl text-orange-600"></i>
          <p className="mt-4 text-gray-500">Loading plan...</p>
        </div>
      </div>
    )
  }

  // Use adjusted projection for display
  const displayProjection = adjustedProjection

  return (
    <>
      <Head>
        <title>{plan.name} | Independence Planning | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-4">
        <div className="container mx-auto px-4">
          {/* Compact Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/independence"
                className="text-gray-400 hover:text-orange-600 transition-colors"
                title="Back to Plans"
              >
                <i className="fas fa-arrow-left"></i>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{plan.name}</h1>
                <p className="text-sm text-gray-500">
                  {plan.planningHorizonYears} year horizon
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Currency selector */}
              <select
                value={displayCurrency || planCurrency}
                onChange={(e) =>
                  setDisplayCurrency(
                    e.target.value === planCurrency ? null : e.target.value,
                  )
                }
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                title="Display currency"
              >
                {availableCurrencies.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code}
                  </option>
                ))}
              </select>
              <button
                onClick={handleExport}
                className="text-gray-400 hover:text-gray-600 p-2"
                title="Export plan as JSON"
              >
                <i className="fas fa-download"></i>
              </button>
              <Link
                href={`/independence/wizard/${plan.id}`}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                <i className="fas fa-edit mr-1"></i>
                Edit
              </Link>
            </div>
          </div>

          {/* FIRE Summary Bar - Only show when backend data is available */}
          {adjustedProjection?.fiMetrics ? (
            <FiSummaryBar
              fiNumber={adjustedProjection.fiMetrics.fiNumber * effectiveFxRate}
              liquidAssets={liquidAssets * effectiveFxRate}
              illiquidAssets={nonSpendableAssets * effectiveFxRate}
              currency={effectiveCurrency}
              isCoastFire={adjustedProjection.fiMetrics.isCoastFire}
              yearsToRetirement={fiMetrics?.yearsToRetirement ?? undefined}
              backendFiProgress={adjustedProjection.fiMetrics.fiProgress}
            />
          ) : (
            isCalculating && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Calculating FI metrics...</span>
                </div>
              </div>
            )
          )}

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-4">
            <nav className="flex space-x-6 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm flex items-center whitespace-nowrap
                    ${
                      activeTab === tab.id
                        ? "border-orange-500 text-orange-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <i className={`fas ${tab.icon} mr-1.5 text-xs`}></i>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Global What-If toolbar - available on all tabs */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={() => setShowWhatIfModal(true)}
              className="py-1.5 px-3 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center"
            >
              <i className="fas fa-sliders-h mr-2"></i>
              What-If
            </button>
            {/* Quick scenario toggles */}
            {quickScenarios.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {quickScenarios.map((scenario: QuickScenario) => {
                  const isSelected = selectedScenarioIds.includes(scenario.id)
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => toggleScenario(scenario.id)}
                      className={`px-2 py-1 text-xs rounded-full transition-colors ${
                        isSelected
                          ? "bg-orange-500 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                      title={scenario.description}
                    >
                      {isSelected && <i className="fas fa-check mr-1"></i>}
                      {scenario.name}
                    </button>
                  )
                })}
              </div>
            )}
            {/* Show indicator if there are unsaved changes */}
            {(hasScenarioChanges(whatIfAdjustments) ||
              Object.keys(scenarioOverrides).length > 0 ||
              selectedScenarioIds.length > 0) && (
              <span className="text-xs text-orange-600">
                <i className="fas fa-circle text-[6px] mr-1"></i>
                Unsaved changes
              </span>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === "details" &&
            (() => {
              // Use in-memory state (scenarioOverrides) with plan as fallback
              // Apply what-if expensesPercent adjustment (e.g., Frugal = 90%)
              const baseExpenses =
                scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses
              const effectiveExpenses = Math.round(
                baseExpenses * (combinedAdjustments.expensesPercent / 100),
              )
              const effectivePension =
                scenarioOverrides.pensionMonthly ?? plan.pensionMonthly ?? 0
              const effectiveSocialSecurity =
                scenarioOverrides.socialSecurityMonthly ??
                plan.socialSecurityMonthly ??
                0
              const effectiveOtherIncome =
                scenarioOverrides.otherIncomeMonthly ??
                plan.otherIncomeMonthly ??
                0
              const effectiveInflation =
                scenarioOverrides.inflationRate ?? plan.inflationRate
              const effectiveTarget =
                scenarioOverrides.targetBalance ?? plan.targetBalance
              const effectiveEquityReturn =
                scenarioOverrides.equityReturnRate ?? plan.equityReturnRate
              const effectiveCashReturn =
                scenarioOverrides.cashReturnRate ?? plan.cashReturnRate
              const effectiveHousingReturn =
                scenarioOverrides.housingReturnRate ?? plan.housingReturnRate
              const netMonthlyNeed =
                effectiveExpenses -
                effectivePension -
                effectiveSocialSecurity -
                effectiveOtherIncome -
                (rentalIncome?.totalMonthlyInPlanCurrency || 0)

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Plan Details */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {t("retire.planDetails")}
                      </h2>
                      <button
                        onClick={() => setShowEditDetailsModal(true)}
                        className="text-sm text-orange-600 hover:text-orange-700"
                      >
                        <i className="fas fa-edit mr-1"></i>
                        Edit
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <InfoTooltip text={t("retire.monthlyExpenses.tooltip")}>
                          <span className="text-gray-500">
                            {t("retire.monthlyExpenses")}
                          </span>
                        </InfoTooltip>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(effectiveExpenses * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {t("retire.pension")}
                        </span>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(effectivePension * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {t("retire.governmentBenefits")}
                        </span>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(effectiveSocialSecurity * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {t("retire.otherIncome")}
                        </span>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(effectiveOtherIncome * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                      {rentalIncome &&
                        rentalIncome.totalMonthlyInPlanCurrency > 0 && (
                          <div className="flex justify-between">
                            <InfoTooltip text="Net rental income from properties (after all expenses). Stops if property is liquidated.">
                              <span className="text-gray-500">
                                <i className="fas fa-home text-xs mr-1"></i>
                                Property Rental
                              </span>
                            </InfoTooltip>
                            <span
                              className={`font-medium ${hideValues ? "text-gray-400" : "text-green-600"}`}
                            >
                              {hideValues
                                ? HIDDEN_VALUE
                                : `${effectiveCurrency}${Math.round(rentalIncome.totalMonthlyInPlanCurrency * effectiveFxRate).toLocaleString()}`}
                            </span>
                          </div>
                        )}
                      <div className="flex justify-between">
                        <InfoTooltip text={t("retire.netMonthlyNeed.tooltip")}>
                          <span className="text-gray-500">
                            {t("retire.netMonthlyNeed")}
                          </span>
                        </InfoTooltip>
                        <span
                          className={`font-medium ${hideValues ? "text-gray-400" : "text-orange-600"}`}
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(netMonthlyNeed * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                      <hr />
                      <div className="flex justify-between">
                        <InfoTooltip text={t("retire.inflation.tooltip")}>
                          <span className="text-gray-500">
                            {t("retire.inflation")}
                          </span>
                        </InfoTooltip>
                        <span className="font-medium">
                          {(effectiveInflation * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Return Rates</span>
                        <span className="font-medium text-blue-600">
                          E:{(effectiveEquityReturn * 100).toFixed(0)}% C:
                          {(effectiveCashReturn * 100).toFixed(0)}% H:
                          {(effectiveHousingReturn * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Blended Return Rate
                        </span>
                        <span className="font-medium text-blue-600">
                          {(blendedReturnRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      {effectiveTarget && effectiveTarget > 0 && (
                        <div className="flex justify-between">
                          <InfoTooltip text={t("retire.targetBalance.tooltip")}>
                            <span className="text-gray-500">
                              {t("retire.targetBalance")}
                            </span>
                          </InfoTooltip>
                          <span
                            className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                          >
                            {hideValues
                              ? HIDDEN_VALUE
                              : `${effectiveCurrency}${Math.round(effectiveTarget * effectiveFxRate).toLocaleString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

          {/* Assets Tab */}
          {activeTab === "assets" && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("retire.assets.title")}
              </h2>

              {!holdingsData ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                  <p>{t("retire.assets.loadingHoldings")}</p>
                </div>
              ) : categorySlices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-folder-open text-4xl mb-3 text-gray-300"></i>
                  <p>{t("retire.assets.noHoldings")}</p>
                  <p className="text-sm mt-2">
                    {t("retire.assets.noHoldings.hint")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    {t("retire.assets.selectCategories")}
                  </p>
                  <div className="space-y-2">
                    {/* Only show liquid/spendable asset categories */}
                    {categorySlices
                      .filter(
                        (slice) => !DEFAULT_NON_SPENDABLE.includes(slice.key),
                      )
                      .map((slice) => {
                        const isSpendable = spendableCategories.includes(
                          slice.key,
                        )
                        return (
                          <div
                            key={slice.key}
                            className={`p-3 rounded-lg border transition-colors ${
                              isSpendable
                                ? "border-orange-200 bg-orange-50"
                                : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <label className="flex items-center justify-between cursor-pointer">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSpendable}
                                  onChange={() => toggleCategory(slice.key)}
                                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: slice.color }}
                                />
                                <span
                                  className={
                                    isSpendable
                                      ? "text-gray-900"
                                      : "text-gray-500"
                                  }
                                >
                                  {slice.label}
                                </span>
                              </div>
                              <span
                                className={`font-medium ${
                                  hideValues
                                    ? "text-gray-400"
                                    : isSpendable
                                      ? "text-gray-900"
                                      : "text-gray-400"
                                }`}
                              >
                                {hideValues
                                  ? HIDDEN_VALUE
                                  : `${effectiveCurrency}${Math.round(slice.value * holdingsToPlanRate * effectiveFxRate).toLocaleString()}`}
                              </span>
                            </label>
                          </div>
                        )
                      })}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("retire.assets.totalAssets")}
                      </span>
                      <span
                        className={`font-medium ${hideValues ? "text-gray-400" : ""}`}
                      >
                        {hideValues
                          ? HIDDEN_VALUE
                          : `${effectiveCurrency}${Math.round(totalAssets * effectiveFxRate).toLocaleString()}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("retire.assets.spendable")}
                      </span>
                      <span
                        className={`font-medium ${hideValues ? "text-gray-400" : "text-orange-600"}`}
                      >
                        {hideValues
                          ? HIDDEN_VALUE
                          : `${effectiveCurrency}${Math.round(liquidAssets * effectiveFxRate).toLocaleString()}`}
                      </span>
                    </div>
                    {totalAssets > liquidAssets && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          {t("retire.assets.nonSpendable")}
                        </span>
                        <span className="font-medium text-gray-400">
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round((totalAssets - liquidAssets) * effectiveFxRate).toLocaleString()}`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Blended Return Rate</span>
                      <span className="font-medium text-blue-600">
                        {(blendedReturnRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between font-medium text-lg">
                      <span>{t("retire.assets.spendableAtRetirement")}</span>
                      <span
                        className={
                          hideValues ? "text-gray-400" : "text-orange-600"
                        }
                      >
                        {hideValues
                          ? HIDDEN_VALUE
                          : `${effectiveCurrency}${Math.round(
                              (displayProjection?.liquidAssets ||
                                liquidAssets) * effectiveFxRate,
                            ).toLocaleString()}`}
                      </span>
                    </div>
                  </div>

                  {isCalculating && (
                    <div className="mt-4 text-center text-gray-500">
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      {t("retire.assets.calculating")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FIRE Tab */}
          {activeTab === "fire" &&
            (() => {
              // Calculate effective values with what-if adjustments
              const effectiveMonthlyInvestment = Math.round(
                monthlyInvestment *
                  (combinedAdjustments.contributionPercent / 100),
              )

              // Use NET expenses (after income sources) for FI calculations
              const netExpenses = fiMetrics?.netMonthlyExpenses ?? 0

              return (
                <div className="space-y-6">
                  {/* Main FIRE Metrics - uses backend values for consistency with PlanCard */}
                  <FiMetrics
                    monthlyExpenses={netExpenses * effectiveFxRate}
                    liquidAssets={liquidAssets * effectiveFxRate}
                    currency={effectiveCurrency}
                    workingIncomeMonthly={
                      (plan.workingIncomeMonthly || 0) * effectiveFxRate
                    }
                    monthlyInvestment={
                      effectiveMonthlyInvestment * effectiveFxRate
                    }
                    expectedReturnRate={blendedReturnRate}
                    currentAge={currentAge}
                    retirementAge={retirementAge}
                    backendFiNumber={
                      adjustedProjection?.fiMetrics?.fiNumber
                        ? adjustedProjection.fiMetrics.fiNumber *
                          effectiveFxRate
                        : undefined
                    }
                    backendFiProgress={
                      adjustedProjection?.fiMetrics?.fiProgress
                    }
                    backendCoastFiNumber={
                      adjustedProjection?.fiMetrics?.coastFiNumber
                        ? adjustedProjection.fiMetrics.coastFiNumber *
                          effectiveFxRate
                        : undefined
                    }
                    backendCoastFiProgress={
                      adjustedProjection?.fiMetrics?.coastFiProgress
                    }
                    backendIsCoastFire={
                      adjustedProjection?.fiMetrics?.isCoastFire
                    }
                  />

                  {/* Income from Assets explanation */}
                  {(fiMetrics?.totalMonthlyIncome ?? 0) > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        <i className="fas fa-coins text-green-500 mr-2"></i>
                        Income Reducing Your FI Target
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Your FI Number is based on <strong>net</strong> expenses
                        - what you need from investments after accounting for
                        other income sources.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-500 mb-1">
                            Monthly Income Sources
                          </div>
                          <div className="text-xl font-bold text-green-600">
                            {hideValues ? (
                              HIDDEN_VALUE
                            ) : (
                              <>
                                {effectiveCurrency}
                                {Math.round(
                                  (fiMetrics?.totalMonthlyIncome ?? 0) *
                                    effectiveFxRate,
                                ).toLocaleString()}
                                /mo
                              </>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Pension + Benefits + Rental + Other
                          </div>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg">
                          <div className="text-sm text-gray-500 mb-1">
                            Net Monthly Need from Investments
                          </div>
                          <div className="text-xl font-bold text-orange-600">
                            {hideValues ? (
                              HIDDEN_VALUE
                            ) : (
                              <>
                                {effectiveCurrency}
                                {Math.round(
                                  netExpenses * effectiveFxRate,
                                ).toLocaleString()}
                                /mo
                              </>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            This determines your FI Number
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Asset Breakdown */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      <i className="fas fa-chart-pie text-blue-500 mr-2"></i>
                      Asset Breakdown for FI
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Liquid Assets */}
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-sm text-green-700 font-medium mb-1">
                          Liquid (Spendable)
                        </div>
                        <div className="text-2xl font-bold text-green-800">
                          {hideValues ? (
                            HIDDEN_VALUE
                          ) : (
                            <>
                              {effectiveCurrency}
                              {Math.round(
                                liquidAssets * effectiveFxRate,
                              ).toLocaleString()}
                            </>
                          )}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          Used for FI Progress calculation
                        </div>
                      </div>

                      {/* Illiquid Assets */}
                      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="text-sm text-amber-700 font-medium mb-1">
                          Illiquid (Property, etc.)
                        </div>
                        <div className="text-2xl font-bold text-amber-800">
                          {hideValues ? (
                            HIDDEN_VALUE
                          ) : (
                            <>
                              {effectiveCurrency}
                              {Math.round(
                                nonSpendableAssets * effectiveFxRate,
                              ).toLocaleString()}
                            </>
                          )}
                        </div>
                        <div className="text-xs text-amber-600 mt-1">
                          Not included in FI - hard to liquidate
                        </div>
                      </div>

                      {/* Total Net Worth */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-700 font-medium mb-1">
                          Total Net Worth
                        </div>
                        <div className="text-2xl font-bold text-blue-800">
                          {hideValues ? (
                            HIDDEN_VALUE
                          ) : (
                            <>
                              {effectiveCurrency}
                              {Math.round(
                                (liquidAssets + nonSpendableAssets) *
                                  effectiveFxRate,
                              ).toLocaleString()}
                            </>
                          )}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          All assets combined
                        </div>
                      </div>
                    </div>

                    {nonSpendableAssets > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        <i className="fas fa-info-circle text-gray-400 mr-2"></i>
                        <strong>Why separate liquid vs illiquid?</strong> FI
                        calculations use liquid assets because you can&apos;t
                        easily spend property. However, illiquid assets
                        contribute to long-term security and could be sold if
                        needed.
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("retire.timeline.title")}
              </h2>

              {!displayProjection ||
              displayProjection.yearlyProjections.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {isCalculating ? (
                    <>
                      <i className="fas fa-spinner fa-spin text-4xl mb-3 text-orange-400"></i>
                      <p>{t("retire.assets.calculating")}</p>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-chart-line text-4xl mb-3 text-gray-300"></i>
                      <p>{t("retire.timeline.noData")}</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Income Breakdown Table */}
                  <div className="mb-8">
                    <IncomeBreakdownTable
                      projections={displayProjection.yearlyProjections}
                    />
                  </div>

                  <div className="h-72 mb-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={displayProjection.yearlyProjections}
                        margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="age"
                          label={{
                            value: "Age",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            hideValues
                              ? "****"
                              : `$${(value / 1000).toFixed(0)}k`
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip
                          formatter={(value, name) => {
                            const formatted = hideValues
                              ? HIDDEN_VALUE
                              : `$${Number(value || 0).toLocaleString()}`
                            if (name === "totalWealth")
                              return [formatted, "Total Wealth"]
                            if (name === "endingBalance")
                              return [formatted, "Liquid Assets"]
                            return [formatted, name]
                          }}
                          labelFormatter={(label) => `Age ${label}`}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          formatter={(value) =>
                            value === "totalWealth"
                              ? "Total Wealth"
                              : value === "endingBalance"
                                ? "Liquid Assets"
                                : value
                          }
                        />
                        <ReferenceLine y={0} stroke="#ef4444" strokeWidth={2} />
                        {displayProjection.nonSpendableAtRetirement > 0 && (
                          <Line
                            type="monotone"
                            dataKey="totalWealth"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 2, fill: "#3b82f6" }}
                            name="totalWealth"
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="endingBalance"
                          stroke="#ea580c"
                          strokeWidth={3}
                          dot={{ r: 3, fill: "#ea580c" }}
                          name="endingBalance"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-64">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {t("retire.timeline.cashFlows")}
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={displayProjection.yearlyProjections.map((y) => ({
                          ...y,
                          negWithdrawals: -y.withdrawals,
                        }))}
                        margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="age"
                          label={{
                            value: "Age",
                            position: "insideBottom",
                            offset: -10,
                          }}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis
                          tickFormatter={(value) =>
                            hideValues
                              ? "****"
                              : `$${(value / 1000).toFixed(0)}k`
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip
                          formatter={(value, name) => {
                            if (hideValues) {
                              if (name === "negWithdrawals") {
                                return [HIDDEN_VALUE, "Withdrawals"]
                              }
                              return [HIDDEN_VALUE, "Investment Returns"]
                            }
                            const absVal = Math.abs(Number(value || 0))
                            if (name === "negWithdrawals") {
                              return [
                                `-$${absVal.toLocaleString()}`,
                                "Withdrawals",
                              ]
                            }
                            return [
                              `+$${absVal.toLocaleString()}`,
                              "Investment Returns",
                            ]
                          }}
                          labelFormatter={(label) => `Age ${label}`}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          formatter={(value) =>
                            value === "negWithdrawals"
                              ? "Withdrawals"
                              : "Investment Returns"
                          }
                        />
                        <ReferenceLine y={0} stroke="#9ca3af" />
                        <Bar
                          dataKey="investment"
                          fill="#22c55e"
                          name="Investment Returns"
                        />
                        <Bar
                          dataKey="negWithdrawals"
                          fill="#ef4444"
                          name="negWithdrawals"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Scenarios Tab - What-If Analysis */}
          {activeTab === "scenarios" && (
            <div className="space-y-6">
              {/* Projected Balance Chart - Primary visual feedback */}
              {displayProjection &&
                displayProjection.yearlyProjections.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Projected Balance
                    </h3>
                    {/* Combined scenario impact summary */}
                    {selectedScenarioIds.length > 0 && (
                      <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-orange-700">
                            Combined Impact:
                          </span>
                          <div className="flex flex-wrap gap-3 text-orange-600">
                            {combinedAdjustments.retirementAgeOffset !== 0 && (
                              <span>
                                Retire{" "}
                                {combinedAdjustments.retirementAgeOffset > 0
                                  ? "+"
                                  : ""}
                                {combinedAdjustments.retirementAgeOffset} yr
                              </span>
                            )}
                            {combinedAdjustments.expensesPercent !== 100 && (
                              <span>
                                Expenses {combinedAdjustments.expensesPercent}%
                              </span>
                            )}
                            {combinedAdjustments.contributionPercent !==
                              100 && (
                              <span>
                                Savings{" "}
                                {combinedAdjustments.contributionPercent}%
                              </span>
                            )}
                            {combinedAdjustments.returnRateOffset !== 0 && (
                              <span>
                                Returns{" "}
                                {combinedAdjustments.returnRateOffset > 0
                                  ? "+"
                                  : ""}
                                {combinedAdjustments.returnRateOffset}%
                              </span>
                            )}
                            {combinedAdjustments.inflationOffset !== 0 && (
                              <span>
                                Inflation{" "}
                                {combinedAdjustments.inflationOffset > 0
                                  ? "+"
                                  : ""}
                                {combinedAdjustments.inflationOffset}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={displayProjection.yearlyProjections}
                          margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e5e7eb"
                          />
                          <XAxis
                            dataKey="age"
                            label={{
                              value: "Age",
                              position: "insideBottom",
                              offset: -10,
                            }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            tickFormatter={(value) =>
                              hideValues
                                ? "****"
                                : `$${(value / 1000).toFixed(0)}k`
                            }
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip
                            formatter={(value, name) => {
                              const formatted = hideValues
                                ? "****"
                                : `$${Number(value || 0).toLocaleString()}`
                              if (name === "totalWealth")
                                return [formatted, "Total Wealth"]
                              if (name === "endingBalance")
                                return [formatted, "Liquid Assets"]
                              return [formatted, name]
                            }}
                            labelFormatter={(label) => `Age ${label}`}
                          />
                          <Legend
                            verticalAlign="top"
                            height={36}
                            formatter={(value) =>
                              value === "totalWealth"
                                ? "Total Wealth"
                                : value === "endingBalance"
                                  ? "Liquid Assets"
                                  : value
                            }
                          />
                          <ReferenceLine
                            y={0}
                            stroke="#ef4444"
                            strokeWidth={2}
                          />
                          {displayProjection.yearlyProjections.find(
                            (y) => y.propertyLiquidated,
                          ) && (
                            <ReferenceLine
                              x={
                                displayProjection.yearlyProjections.find(
                                  (y) => y.propertyLiquidated,
                                )?.age
                              }
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={{
                                value: "Property Sold",
                                position: "top",
                                fontSize: 10,
                                fill: "#8b5cf6",
                              }}
                            />
                          )}
                          {displayProjection.nonSpendableAtRetirement > 0 && (
                            <Line
                              type="monotone"
                              dataKey="totalWealth"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 2, fill: "#3b82f6" }}
                              name="totalWealth"
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="endingBalance"
                            stroke="#ea580c"
                            strokeWidth={3}
                            dot={{ r: 2 }}
                            name="endingBalance"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

              {/* Impact summary and action buttons */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Impact summary - wider */}
                <div className="lg:col-span-2">
                  <ScenarioImpact
                    projection={displayProjection}
                    lifeExpectancy={lifeExpectancy}
                    currency={effectiveCurrency}
                    fxRate={effectiveFxRate}
                    whatIfAdjustments={combinedAdjustments}
                    onLiquidationThresholdChange={(value) =>
                      setWhatIfAdjustments((prev) => ({
                        ...prev,
                        liquidationThreshold: value,
                      }))
                    }
                  />
                </div>

                {/* Action buttons - narrower */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
                    {(scenarioHasChanges ||
                      hasScenarioOverrides ||
                      selectedScenarioIds.length > 0) && (
                      <>
                        <button
                          onClick={() => setShowSaveDialog(true)}
                          className="w-full py-2 border border-orange-500 text-orange-500 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
                        >
                          <i className="fas fa-save mr-2"></i>
                          Save Scenario
                        </button>
                        <button
                          onClick={() => {
                            resetWhatIf()
                            resetScenarioOverrides()
                            setSelectedScenarioIds([])
                          }}
                          className="w-full py-1 text-gray-500 hover:text-gray-700 text-xs"
                        >
                          <i className="fas fa-undo mr-1"></i>
                          Reset All
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Scenario Dialog */}
      <SaveScenarioDialog
        isOpen={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveScenario}
        planName={plan.name}
        isSaving={isSaving}
      />

      {/* Edit Details Modal */}
      <EditPlanDetailsModal
        isOpen={showEditDetailsModal}
        onClose={() => setShowEditDetailsModal(false)}
        onApply={handleApplyDetails}
        plan={plan}
      />

      {/* What-If Analysis Modal */}
      <WhatIfModal
        isOpen={showWhatIfModal}
        onClose={() => setShowWhatIfModal(false)}
        plan={plan}
        whatIfAdjustments={whatIfAdjustments}
        onAdjustmentsChange={setWhatIfAdjustments}
        scenarioOverrides={scenarioOverrides}
        onScenarioOverridesChange={setScenarioOverrides}
        onReset={() => {
          resetWhatIf()
          resetScenarioOverrides()
        }}
        retirementAge={retirementAge}
        monthlyInvestment={monthlyInvestment}
        rentalIncome={rentalIncome}
      />
    </>
  )
}

export default withPageAuthRequired(PlanView)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
