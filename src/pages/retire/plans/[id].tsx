import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import useSwr from "swr"
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
  ProjectionResponse,
  RetirementProjection,
  YearlyProjection,
  QuickScenario,
  QuickScenariosResponse,
} from "types/retirement"
import { Portfolio, HoldingContract } from "types/beancounter"
import {
  transformToAllocationSlices,
  AllocationSlice,
} from "@lib/allocation/aggregateHoldings"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

interface PortfoliosResponse {
  data: Portfolio[]
}

// Life event type
interface LifeEvent {
  id: string
  age: number
  amount: number
  description: string
  type: "income" | "expense"
}

// What-if adjustments
interface WhatIfAdjustments {
  retirementAgeOffset: number
  expensesPercent: number
  returnRateOffset: number
  inflationOffset: number
  contributionPercent: number // % of base monthly investment (100 = no change)
}

// Default non-spendable categories (property typically can't be easily liquidated)
const DEFAULT_NON_SPENDABLE = ["Property"]

type TabId = "details" | "assets" | "projection" | "timeline" | "scenarios"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "details", label: "Details", icon: "fa-clipboard-list" },
  { id: "assets", label: "Assets", icon: "fa-wallet" },
  { id: "projection", label: "Projection", icon: "fa-calculator" },
  { id: "timeline", label: "Timeline", icon: "fa-chart-line" },
  { id: "scenarios", label: "Scenarios", icon: "fa-sliders-h" },
]

// Slider component for What-If adjustments
function WhatIfSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  formatValue,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit: string
  formatValue?: (v: number) => string
}): React.ReactElement {
  const displayValue = formatValue
    ? formatValue(value)
    : `${value > 0 ? "+" : ""}${value}${unit}`
  const isPositive = value > 0
  const isNegative = value < 0

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span
          className={`text-sm font-semibold ${
            isPositive
              ? "text-green-600"
              : isNegative
                ? "text-red-600"
                : "text-gray-600"
          }`}
        >
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatValue ? formatValue(min) : `${min}${unit}`}</span>
        <span>
          {formatValue
            ? formatValue(max)
            : `${max > 0 ? "+" : ""}${max}${unit}`}
        </span>
      </div>
    </div>
  )
}

function PlanView(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { id } = router.query
  const hasAutoSelected = useRef(false)
  const hasAutoCalculated = useRef(false)
  const hasCategoriesInitialized = useRef(false)
  const [activeTab, setActiveTab] = useState<TabId>("details")
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([])
  const [spendableCategories, setSpendableCategories] = useState<string[]>([])
  const [projection, setProjection] = useState<RetirementProjection | null>(
    null,
  )
  const [isCalculating, setIsCalculating] = useState(false)

  // What-If state
  const [whatIfAdjustments, setWhatIfAdjustments] = useState<WhatIfAdjustments>(
    {
      retirementAgeOffset: 0,
      expensesPercent: 100,
      returnRateOffset: 0,
      inflationOffset: 0,
      contributionPercent: 100,
    },
  )

  // Life events state
  const [lifeEvents, setLifeEvents] = useState<LifeEvent[]>([])
  const [newEvent, setNewEvent] = useState<Partial<LifeEvent>>({
    age: 70,
    amount: 0,
    description: "",
    type: "expense",
  })

  const { data: planData, error: planError } = useSwr<PlanResponse>(
    id ? `/api/retire/plans/${id}` : null,
    id ? simpleFetcher(`/api/retire/plans/${id}`) : null,
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

  // Fetch quick scenarios for What-If analysis
  const { data: scenariosData } = useSwr<QuickScenariosResponse>(
    "/api/retire/scenarios",
    simpleFetcher("/api/retire/scenarios"),
  )
  const quickScenarios = scenariosData?.data || []

  const plan = planData?.data
  const planCurrency = plan?.expensesCurrency || "NZD"

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
    if (categorySlices.length > 0 && !hasCategoriesInitialized.current) {
      const allCategories = categorySlices.map((s) => s.key)
      const spendable = allCategories.filter(
        (cat) => !DEFAULT_NON_SPENDABLE.includes(cat),
      )
      setSpendableCategories(spendable)
      hasCategoriesInitialized.current = true
    }
  }, [categorySlices])

  // Calculate total assets from category slices
  const totalAssets = useMemo(() => {
    return categorySlices.reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices])

  // Calculate liquid (spendable) assets - only selected categories
  const liquidAssets = useMemo(() => {
    return categorySlices
      .filter((slice) => spendableCategories.includes(slice.key))
      .reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices, spendableCategories])

  // Calculate non-spendable assets (e.g., property)
  const nonSpendableAssets = useMemo(() => {
    return categorySlices
      .filter((slice) => !spendableCategories.includes(slice.key))
      .reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices, spendableCategories])

  // Toggle category spendable status
  const toggleCategory = (category: string): void => {
    setSpendableCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    )
    // Reset projection when categories change
    setProjection(null)
    hasAutoCalculated.current = false
  }

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

  const handleCalculateProjection = useCallback(async (): Promise<void> => {
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

  const handleExport = async (): Promise<void> => {
    if (!plan) return

    try {
      const response = await fetch(`/api/retire/plans/${plan.id}/export`)
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
      handleCalculateProjection()
    }
  }, [
    plan,
    liquidAssets,
    spendableCategories,
    projection,
    handleCalculateProjection,
  ])

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

    // Always recalculate to ensure full timeline to life expectancy
    const adjustedRetirementAge = retirementAge + retirementAgeOffset
    const baseExpenses = plan.monthlyExpenses * 12 * (expensesPercent / 100)
    const baseReturnRate =
      plan.equityReturnRate * plan.equityAllocation +
      plan.cashReturnRate * plan.cashAllocation +
      plan.housingReturnRate * plan.housingAllocation
    const adjustedReturnRate = baseReturnRate + returnRateOffset / 100
    const adjustedInflation = plan.inflationRate + inflationOffset / 100

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

    if (retirementAgeOffset !== 0) {
      const extraYears = retirementAgeOffset

      if (extraYears > 0) {
        // Working longer: compound existing assets and add contributions
        for (let y = 0; y < extraYears; y++) {
          // Growth on existing liquid assets
          adjustedLiquidAssets = adjustedLiquidAssets * (1 + baseReturnRate)
          // Add year's contributions (using adjusted contribution)
          adjustedLiquidAssets += adjustedAnnualContribution
          // Non-spendable assets also grow
          adjustedNonSpendable =
            adjustedNonSpendable * (1 + plan.housingReturnRate)
        }
      } else {
        // Retiring earlier: reverse compound (approximate)
        for (let y = 0; y < Math.abs(extraYears); y++) {
          // Remove a year of growth and contributions
          adjustedLiquidAssets =
            (adjustedLiquidAssets - adjustedAnnualContribution) /
            (1 + baseReturnRate)
          adjustedNonSpendable =
            adjustedNonSpendable / (1 + plan.housingReturnRate)
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

    // Create life events lookup by age
    const eventsByAge = new Map<number, number>()
    lifeEvents.forEach((event) => {
      const current = eventsByAge.get(event.age) || 0
      const amount = event.type === "income" ? event.amount : -event.amount
      eventsByAge.set(event.age, current + amount)
    })

    // Calculate from retirement age to life expectancy (show full timeline)
    const yearsInRetirement = lifeExpectancy - adjustedRetirementAge
    const initialLiquidAssets = adjustedLiquidAssets
    const liquidationThreshold = 0.1 // Sell non-liquid assets when liquid drops to 10%
    let hasLiquidatedProperty = false
    let propertyLiquidationAge: number | undefined

    for (let i = 0; i <= yearsInRetirement; i++) {
      const age = adjustedRetirementAge + i

      // Check if we should liquidate non-spendable assets (property)
      // Trigger when liquid assets fall below 10% of initial and we haven't already sold
      if (
        !hasLiquidatedProperty &&
        nonSpendable > 0 &&
        balance < initialLiquidAssets * liquidationThreshold &&
        balance > 0
      ) {
        // Sell property - add proceeds to liquid assets
        balance += nonSpendable
        nonSpendable = 0
        hasLiquidatedProperty = true
        propertyLiquidationAge = age
      }

      const startingBalance = Math.max(0, balance)
      const investment = startingBalance * adjustedReturnRate

      // After property sale, "other income" (rent) stops
      const otherIncome = hasLiquidatedProperty
        ? 0
        : plan.otherIncomeMonthly || 0
      const income =
        (plan.pensionMonthly + plan.socialSecurityMonthly + otherIncome) * 12
      const withdrawals = balance > 0 ? Math.max(0, expenses - income) : 0

      // Apply life events for this age
      const eventAdjustment = eventsByAge.get(age) || 0

      balance = balance + investment - withdrawals + eventAdjustment
      if (!hasLiquidatedProperty) {
        nonSpendable = nonSpendable * (1 + plan.housingReturnRate)
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
      })
    }

    // Calculate adjusted runway
    const depletionYear = adjustedYearlyProjections.findIndex(
      (y) => y.endingBalance <= 0,
    )
    const runwayYears =
      depletionYear >= 0 ? depletionYear + 1 : adjustedYearlyProjections.length
    const depletionAge =
      depletionYear >= 0 ? adjustedRetirementAge + depletionYear + 1 : undefined

    return {
      ...projection,
      yearlyProjections: adjustedYearlyProjections,
      runwayYears,
      runwayMonths: runwayYears * 12,
      depletionAge,
    }
  }, [
    projection,
    plan,
    whatIfAdjustments,
    lifeEvents,
    retirementAge,
    lifeExpectancy,
    planCurrency,
    monthlyInvestment,
  ])

  // Add life event
  const addLifeEvent = (): void => {
    if (!newEvent.amount || !newEvent.description) return

    const event: LifeEvent = {
      id: Date.now().toString(),
      age: newEvent.age || 70,
      amount: newEvent.amount,
      description: newEvent.description,
      type: newEvent.type || "expense",
    }
    setLifeEvents((prev) => [...prev, event])
    setNewEvent({ age: 70, amount: 0, description: "", type: "expense" })
  }

  // Remove life event
  const removeLifeEvent = (id: string): void => {
    setLifeEvents((prev) => prev.filter((e) => e.id !== id))
  }

  // Reset what-if adjustments
  const resetWhatIf = (): void => {
    setWhatIfAdjustments({
      retirementAgeOffset: 0,
      expensesPercent: 100,
      returnRateOffset: 0,
      inflationOffset: 0,
      contributionPercent: 100,
    })
    setLifeEvents([])
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
        <title>{plan.name} | Retirement Planning | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-4">
        <div className="container mx-auto px-4">
          {/* Compact Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/retire"
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
              <button
                onClick={handleExport}
                className="text-gray-400 hover:text-gray-600 p-2"
                title="Export plan as JSON"
              >
                <i className="fas fa-download"></i>
              </button>
              <Link
                href={`/retire/wizard/${plan.id}`}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                <i className="fas fa-edit mr-1"></i>
                Edit
              </Link>
            </div>
          </div>

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

          {/* Tab Content */}
          {activeTab === "details" && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("retire.planDetails")}
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <InfoTooltip text={t("retire.monthlyExpenses.tooltip")}>
                    <span className="text-gray-500">
                      {t("retire.monthlyExpenses")}
                    </span>
                  </InfoTooltip>
                  <span className="font-medium">
                    ${plan.monthlyExpenses.toLocaleString()}{" "}
                    {plan.expensesCurrency}
                  </span>
                </div>
                {plan.pensionMonthly > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("retire.pension")}</span>
                    <span className="font-medium">
                      ${plan.pensionMonthly.toLocaleString()}
                    </span>
                  </div>
                )}
                {plan.socialSecurityMonthly > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      {t("retire.governmentBenefits")}
                    </span>
                    <span className="font-medium">
                      ${plan.socialSecurityMonthly.toLocaleString()}
                    </span>
                  </div>
                )}
                {plan.otherIncomeMonthly > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      {t("retire.otherIncome")}
                    </span>
                    <span className="font-medium">
                      ${plan.otherIncomeMonthly.toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <InfoTooltip text={t("retire.netMonthlyNeed.tooltip")}>
                    <span className="text-gray-500">
                      {t("retire.netMonthlyNeed")}
                    </span>
                  </InfoTooltip>
                  <span className="font-medium text-orange-600">
                    $
                    {(
                      plan.monthlyExpenses -
                      (plan.pensionMonthly || 0) -
                      plan.socialSecurityMonthly -
                      (plan.otherIncomeMonthly || 0)
                    ).toLocaleString()}
                  </span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <InfoTooltip text={t("retire.equityReturn.tooltip")}>
                    <span className="text-gray-500">
                      {t("retire.equityReturn")}
                    </span>
                  </InfoTooltip>
                  <span className="font-medium">
                    {(plan.equityReturnRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <InfoTooltip text={t("retire.inflation.tooltip")}>
                    <span className="text-gray-500">
                      {t("retire.inflation")}
                    </span>
                  </InfoTooltip>
                  <span className="font-medium">
                    {(plan.inflationRate * 100).toFixed(1)}%
                  </span>
                </div>
                {plan.targetBalance && (
                  <div className="flex justify-between">
                    <InfoTooltip text={t("retire.targetBalance.tooltip")}>
                      <span className="text-gray-500">
                        {t("retire.targetBalance")}
                      </span>
                    </InfoTooltip>
                    <span className="font-medium">
                      ${plan.targetBalance.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                    {categorySlices.map((slice) => {
                      const isSpendable = spendableCategories.includes(
                        slice.key,
                      )
                      return (
                        <label
                          key={slice.key}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSpendable
                              ? "border-orange-200 bg-orange-50"
                              : "border-gray-200 bg-gray-50"
                          }`}
                        >
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
                                isSpendable ? "text-gray-900" : "text-gray-500"
                              }
                            >
                              {slice.label}
                            </span>
                          </div>
                          <span
                            className={`font-medium ${
                              isSpendable ? "text-gray-900" : "text-gray-400"
                            }`}
                          >
                            ${Math.round(slice.value).toLocaleString()}
                          </span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("retire.assets.totalAssets")}
                      </span>
                      <span className="font-medium">
                        ${Math.round(totalAssets).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">
                        {t("retire.assets.spendable")}
                      </span>
                      <span className="font-medium text-orange-600">
                        ${Math.round(liquidAssets).toLocaleString()}
                      </span>
                    </div>
                    {totalAssets > liquidAssets && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          {t("retire.assets.nonSpendable")}
                        </span>
                        <span className="font-medium text-gray-400">
                          $
                          {Math.round(
                            totalAssets - liquidAssets,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between font-medium text-lg">
                      <span>{t("retire.assets.spendableAtRetirement")}</span>
                      <span className="text-orange-600">
                        $
                        {Math.round(
                          displayProjection?.liquidAssets || liquidAssets,
                        ).toLocaleString()}
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

          {/* Projection Tab */}
          {activeTab === "projection" && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("retire.projection.title")}
              </h2>
              {!displayProjection ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-chart-line text-4xl mb-3 text-gray-300"></i>
                  <p>{t("retire.projection.calculate")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600 font-medium">
                      {t("retire.projection.howLongAssetsLast")}
                    </p>
                    <p className="text-3xl font-bold text-orange-700">
                      {displayProjection.runwayYears.toFixed(1)} years
                    </p>
                  </div>

                  {displayProjection.depletionAge && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">
                        {t("retire.projection.fundsDepletedAtAge")}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {displayProjection.depletionAge}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                            `$${(value / 1000).toFixed(0)}k`
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip
                          formatter={(value, name) => {
                            const formatted = `$${Number(value || 0).toLocaleString()}`
                            if (name === "totalWealth")
                              return [formatted, "Total Wealth"]
                            if (name === "endingBalance")
                              return [formatted, "Liquid Assets"]
                            return [formatted, name]
                          }}
                          labelFormatter={(label) => `Age ${label}`}
                        />
                        <Legend
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
                            `$${(value / 1000).toFixed(0)}k`
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip
                          formatter={(value, name) => {
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* What-If Sliders Panel */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                      <i className="fas fa-sliders-h mr-2 text-orange-500"></i>
                      What-If Analysis
                    </h2>
                    <button
                      onClick={resetWhatIf}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      <i className="fas fa-undo mr-1"></i>
                      Reset
                    </button>
                  </div>

                  <div className="space-y-6">
                    <WhatIfSlider
                      label="Retirement Age"
                      value={whatIfAdjustments.retirementAgeOffset}
                      onChange={(v) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          retirementAgeOffset: v,
                        }))
                      }
                      min={-5}
                      max={10}
                      step={1}
                      unit=" years"
                      formatValue={(v) =>
                        `${retirementAge + v} (${v >= 0 ? "+" : ""}${v})`
                      }
                    />

                    <WhatIfSlider
                      label="Pre-Retirement Investment"
                      value={whatIfAdjustments.contributionPercent}
                      onChange={(v) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          contributionPercent: v,
                        }))
                      }
                      min={0}
                      max={200}
                      step={10}
                      unit="%"
                      formatValue={(v) => {
                        const adjusted = Math.round(
                          monthlyInvestment * (v / 100),
                        )
                        return `$${adjusted.toLocaleString()}/mo (${v}%)`
                      }}
                    />

                    <WhatIfSlider
                      label="Monthly Expenses"
                      value={whatIfAdjustments.expensesPercent}
                      onChange={(v) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          expensesPercent: v,
                        }))
                      }
                      min={50}
                      max={150}
                      step={5}
                      unit="%"
                      formatValue={(v) =>
                        `${v}% ($${Math.round((plan.monthlyExpenses * v) / 100).toLocaleString()})`
                      }
                    />

                    <WhatIfSlider
                      label="Investment Returns"
                      value={whatIfAdjustments.returnRateOffset}
                      onChange={(v) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          returnRateOffset: v,
                        }))
                      }
                      min={-4}
                      max={4}
                      step={0.5}
                      unit="%"
                      formatValue={(v) => {
                        const baseRate =
                          (plan.equityReturnRate * plan.equityAllocation +
                            plan.cashReturnRate * plan.cashAllocation +
                            plan.housingReturnRate * plan.housingAllocation) *
                          100
                        const adjusted = baseRate + v
                        return `${adjusted.toFixed(1)}% (${v >= 0 ? "+" : ""}${v})`
                      }}
                    />

                    <WhatIfSlider
                      label="Inflation Rate"
                      value={whatIfAdjustments.inflationOffset}
                      onChange={(v) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          inflationOffset: v,
                        }))
                      }
                      min={-2}
                      max={4}
                      step={0.5}
                      unit="%"
                      formatValue={(v) => {
                        const baseRate = plan.inflationRate * 100
                        const adjusted = baseRate + v
                        return `${adjusted.toFixed(1)}% (${v >= 0 ? "+" : ""}${v})`
                      }}
                    />
                  </div>
                </div>

                {/* Life Events */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    <i className="fas fa-calendar-alt mr-2 text-orange-500"></i>
                    Life Events
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Model one-time income or expenses at specific ages
                  </p>

                  {/* Add new event form */}
                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Age</label>
                        <input
                          type="number"
                          value={newEvent.age}
                          onChange={(e) =>
                            setNewEvent((prev) => ({
                              ...prev,
                              age: Number(e.target.value),
                            }))
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                          min={retirementAge}
                          max={lifeExpectancy}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Amount</label>
                        <input
                          type="number"
                          value={newEvent.amount || ""}
                          onChange={(e) =>
                            setNewEvent((prev) => ({
                              ...prev,
                              amount: Number(e.target.value),
                            }))
                          }
                          placeholder="$"
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Description (e.g., New car, Inheritance)"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setNewEvent((prev) => ({ ...prev, type: "expense" }))
                        }
                        className={`flex-1 py-1 px-2 text-sm rounded ${
                          newEvent.type === "expense"
                            ? "bg-red-100 text-red-700 border border-red-300"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <i className="fas fa-minus-circle mr-1"></i>
                        Expense
                      </button>
                      <button
                        onClick={() =>
                          setNewEvent((prev) => ({ ...prev, type: "income" }))
                        }
                        className={`flex-1 py-1 px-2 text-sm rounded ${
                          newEvent.type === "income"
                            ? "bg-green-100 text-green-700 border border-green-300"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <i className="fas fa-plus-circle mr-1"></i>
                        Income
                      </button>
                    </div>
                    <button
                      onClick={addLifeEvent}
                      disabled={!newEvent.amount || !newEvent.description}
                      className="w-full py-2 bg-orange-500 text-white rounded text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Event
                    </button>
                  </div>

                  {/* Event list */}
                  {lifeEvents.length > 0 && (
                    <div className="space-y-2 border-t pt-3">
                      {lifeEvents
                        .sort((a, b) => a.age - b.age)
                        .map((event) => (
                          <div
                            key={event.id}
                            className={`flex items-center justify-between p-2 rounded text-sm ${
                              event.type === "income"
                                ? "bg-green-50 border border-green-200"
                                : "bg-red-50 border border-red-200"
                            }`}
                          >
                            <div>
                              <span className="font-medium">
                                Age {event.age}:
                              </span>{" "}
                              {event.description}
                              <span
                                className={`ml-2 font-semibold ${
                                  event.type === "income"
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {event.type === "income" ? "+" : "-"}$
                                {event.amount.toLocaleString()}
                              </span>
                            </div>
                            <button
                              onClick={() => removeLifeEvent(event.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Scenario Results */}
              <div className="lg:col-span-2 space-y-6">
                {/* Quick Scenarios - at top for easy access */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Quick Scenarios
                  </h3>
                  {quickScenarios.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Loading scenarios...
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {quickScenarios.map((scenario: QuickScenario) => (
                        <button
                          key={scenario.id}
                          onClick={() =>
                            setWhatIfAdjustments({
                              retirementAgeOffset: scenario.retirementAgeOffset,
                              expensesPercent: scenario.expensesPercent,
                              returnRateOffset: scenario.returnRateOffset,
                              inflationOffset: scenario.inflationOffset,
                              contributionPercent: scenario.contributionPercent,
                            })
                          }
                          className="p-3 border rounded-lg text-left hover:bg-gray-50"
                        >
                          <p className="font-medium text-sm">{scenario.name}</p>
                          {scenario.description && (
                            <p className="text-xs text-gray-500">
                              {scenario.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Impact Summary */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Scenario Impact
                  </h2>

                  {!displayProjection ? (
                    <div className="text-center py-8 text-gray-500">
                      <i className="fas fa-calculator text-4xl mb-3 text-gray-300"></i>
                      <p>Calculate a projection first</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-orange-50 rounded-lg p-4">
                          <p className="text-sm text-orange-600 font-medium">
                            Runway
                          </p>
                          <p className="text-2xl font-bold text-orange-700">
                            {displayProjection.runwayYears.toFixed(1)} years
                          </p>
                          {projection &&
                            displayProjection.runwayYears !==
                              projection.runwayYears && (
                              <p
                                className={`text-sm ${
                                  displayProjection.runwayYears >
                                  projection.runwayYears
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {displayProjection.runwayYears >
                                projection.runwayYears
                                  ? "+"
                                  : ""}
                                {(
                                  displayProjection.runwayYears -
                                  projection.runwayYears
                                ).toFixed(1)}{" "}
                                vs base
                              </p>
                            )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">
                            Funds Last Until Age
                          </p>
                          <p className="text-2xl font-bold text-gray-900">
                            {displayProjection.depletionAge ||
                              "Beyond " + lifeExpectancy}
                          </p>
                          {projection &&
                            displayProjection.depletionAge !==
                              projection.depletionAge && (
                              <p
                                className={`text-sm ${
                                  (displayProjection.depletionAge || 999) >
                                  (projection.depletionAge || 999)
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {(displayProjection.depletionAge ||
                                  lifeExpectancy) >
                                (projection.depletionAge || lifeExpectancy)
                                  ? "+"
                                  : ""}
                                {(displayProjection.depletionAge ||
                                  lifeExpectancy) -
                                  (projection.depletionAge ||
                                    lifeExpectancy)}{" "}
                                years
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Property liquidation notice */}
                      {displayProjection.yearlyProjections.find(
                        (y) => y.propertyLiquidated,
                      ) && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <i className="fas fa-home text-purple-500 mt-0.5"></i>
                            <div>
                              <p className="text-sm font-medium text-purple-700">
                                Property Sale at Age{" "}
                                {
                                  displayProjection.yearlyProjections.find(
                                    (y) => y.propertyLiquidated,
                                  )?.age
                                }
                              </p>
                              <p className="text-xs text-purple-600 mt-1">
                                When liquid assets drop below 10%, property is
                                sold and rental income stops.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Scenario Chart */}
                {displayProjection &&
                  displayProjection.yearlyProjections.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Projected Balance
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={displayProjection.yearlyProjections}
                            margin={{
                              top: 10,
                              right: 30,
                              left: 20,
                              bottom: 20,
                            }}
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
                                `$${(value / 1000).toFixed(0)}k`
                              }
                              tick={{ fontSize: 12 }}
                            />
                            <ChartTooltip
                              formatter={(value, name) => {
                                const formatted = `$${Number(value || 0).toLocaleString()}`
                                if (name === "totalWealth")
                                  return [formatted, "Total Wealth"]
                                if (name === "endingBalance")
                                  return [formatted, "Liquid Assets"]
                                return [formatted, name]
                              }}
                              labelFormatter={(label) => `Age ${label}`}
                            />
                            <Legend
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
                            {lifeEvents.map((event) => (
                              <ReferenceLine
                                key={event.id}
                                x={event.age}
                                stroke={
                                  event.type === "income"
                                    ? "#22c55e"
                                    : "#ef4444"
                                }
                                strokeDasharray="3 3"
                                label={{
                                  value: event.description,
                                  position: "top",
                                  fontSize: 10,
                                }}
                              />
                            ))}
                            {/* Mark property liquidation event */}
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
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(PlanView)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
