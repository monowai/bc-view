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
} from "types/retirement"
import { Portfolio, HoldingContract } from "types/beancounter"
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
  getCategoryReturnType,
  hasScenarioChanges,
  useRetirementProjection,
  WhatIfModal,
  ScenarioImpact,
  SaveScenarioDialog,
  EditPlanDetailsModal,
} from "@components/features/retire"

interface PortfoliosResponse {
  data: Portfolio[]
}

function PlanView(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { id } = router.query
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

  // Category-specific return rates (key = category name, value = return rate as decimal)
  const [categoryReturnRates, setCategoryReturnRates] = useState<
    Record<string, number>
  >({})

  // Scenario overrides - holds edited values until user decides to save
  const [scenarioOverrides, setScenarioOverrides] = useState<{
    pensionMonthly?: number
    socialSecurityMonthly?: number
    otherIncomeMonthly?: number
    inflationRate?: number
    targetBalance?: number
  }>({})

  // Edit details modal state
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false)
  const [showWhatIfModal, setShowWhatIfModal] = useState(false)

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
  const quickScenarios = useMemo(
    () => scenariosData?.data || [],
    [scenariosData?.data],
  )

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

  // Initialize spendable categories and return rates (all except property by default)
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

      // Initialize category return rates with plan defaults
      const defaultRates: Record<string, number> = {}
      allCategories.forEach((cat) => {
        const returnType = getCategoryReturnType(cat)
        if (returnType === "cash") {
          defaultRates[cat] = plan.cashReturnRate
        } else if (returnType === "housing") {
          defaultRates[cat] = plan.housingReturnRate
        } else {
          defaultRates[cat] = plan.equityReturnRate
        }
      })
      setCategoryReturnRates(defaultRates)

      hasCategoriesInitialized.current = true
    }
  }, [categorySlices, plan])

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

  // Calculate weighted blended return rate based on category allocations
  const blendedReturnRate = useMemo(() => {
    if (totalAssets === 0 || Object.keys(categoryReturnRates).length === 0) {
      // Fall back to plan's allocation-based blended rate
      if (!plan) return 0
      return (
        plan.equityReturnRate * plan.equityAllocation +
        plan.cashReturnRate * plan.cashAllocation +
        plan.housingReturnRate * plan.housingAllocation
      )
    }

    // Calculate weighted average return based on actual holdings
    let weightedSum = 0
    categorySlices.forEach((slice) => {
      const rate = categoryReturnRates[slice.key] ?? 0
      const weight = slice.value / totalAssets
      weightedSum += rate * weight
    })
    return weightedSum
  }, [categorySlices, categoryReturnRates, totalAssets, plan])

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
        retirementAgeOffset: acc.retirementAgeOffset + scenario.retirementAgeOffset,
        returnRateOffset: acc.returnRateOffset + scenario.returnRateOffset,
        inflationOffset: acc.inflationOffset + scenario.inflationOffset,
        // Multiplicative for percentages (e.g., 90% * 110% = 99%)
        expensesPercent: Math.round((acc.expensesPercent * scenario.expensesPercent) / 100),
        contributionPercent: Math.round((acc.contributionPercent * scenario.contributionPercent) / 100),
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
  const {
    adjustedProjection,
    isCalculating,
    resetProjection,
  } = useRetirementProjection({
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
  })

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
        const response = await fetch(`/api/retire/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (response.ok) {
          mutate(`/api/retire/plans/${id}`)
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
        const response = await fetch("/api/retire/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPlan),
        })
        if (response.ok) {
          const result = await response.json()
          setScenarioOverrides({})
          setShowSaveDialog(false)
          router.push(`/retire/plans/${result.data.id}`)
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
                  <span className="font-medium">
                    ${plan.monthlyExpenses.toLocaleString()}{" "}
                    {plan.expensesCurrency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t("retire.pension")}</span>
                  <span className="font-medium">
                    ${(plan.pensionMonthly || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    {t("retire.governmentBenefits")}
                  </span>
                  <span className="font-medium">
                    ${(plan.socialSecurityMonthly || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    {t("retire.otherIncome")}
                  </span>
                  <span className="font-medium">
                    ${(plan.otherIncomeMonthly || 0).toLocaleString()}
                  </span>
                </div>
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
                      (plan.socialSecurityMonthly || 0) -
                      (plan.otherIncomeMonthly || 0)
                    ).toLocaleString()}
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
                    {(plan.inflationRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Blended Return Rate</span>
                  <span className="font-medium text-blue-600">
                    {(blendedReturnRate * 100).toFixed(1)}%
                  </span>
                </div>
                {plan.targetBalance && plan.targetBalance > 0 && (
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
                      const isProperty = slice.key === "Property"
                      const returnRate = categoryReturnRates[slice.key] ?? 0
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
                                isSpendable ? "text-gray-900" : "text-gray-400"
                              }`}
                            >
                              ${Math.round(slice.value).toLocaleString()}
                            </span>
                          </label>
                          {/* Return rate input - not for Property */}
                          {!isProperty && (
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <span className="text-xs text-gray-500">
                                Expected Return:
                              </span>
                              <div className="relative w-20">
                                <input
                                  type="number"
                                  value={Math.round(returnRate * 1000) / 10}
                                  onChange={(e) => {
                                    const newRate =
                                      parseFloat(e.target.value) / 100
                                    setCategoryReturnRates((prev) => ({
                                      ...prev,
                                      [slice.key]: newRate,
                                    }))
                                  }}
                                  className="w-full pl-2 pr-6 py-1 text-sm border rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                                  step="0.5"
                                  min="0"
                                  max="50"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                                  %
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
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
            <div className="space-y-6">
              {/* Projected Balance Chart - Primary visual feedback at top (full width) */}
              {displayProjection &&
                displayProjection.yearlyProjections.length > 0 && (
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Projected Balance
                      </h3>
                      {/* Quick scenario toggle buttons */}
                      {quickScenarios.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {quickScenarios.map((scenario: QuickScenario) => {
                            const isSelected = selectedScenarioIds.includes(scenario.id)
                            return (
                              <button
                                key={scenario.id}
                                onClick={() => toggleScenario(scenario.id)}
                                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                                  isSelected
                                    ? "bg-orange-500 text-white border-orange-500"
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
                    </div>
                    {/* Combined scenario impact summary */}
                    {selectedScenarioIds.length > 0 && (
                      <div className="mb-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-orange-700">Combined Impact:</span>
                          <div className="flex flex-wrap gap-3 text-orange-600">
                            {combinedAdjustments.retirementAgeOffset !== 0 && (
                              <span>
                                Retire {combinedAdjustments.retirementAgeOffset > 0 ? "+" : ""}
                                {combinedAdjustments.retirementAgeOffset} yr
                              </span>
                            )}
                            {combinedAdjustments.expensesPercent !== 100 && (
                              <span>Expenses {combinedAdjustments.expensesPercent}%</span>
                            )}
                            {combinedAdjustments.contributionPercent !== 100 && (
                              <span>Savings {combinedAdjustments.contributionPercent}%</span>
                            )}
                            {combinedAdjustments.returnRateOffset !== 0 && (
                              <span>
                                Returns {combinedAdjustments.returnRateOffset > 0 ? "+" : ""}
                                {combinedAdjustments.returnRateOffset}%
                              </span>
                            )}
                            {combinedAdjustments.inflationOffset !== 0 && (
                              <span>
                                Inflation {combinedAdjustments.inflationOffset > 0 ? "+" : ""}
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
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="age"
                            label={{ value: "Age", position: "insideBottom", offset: -10 }}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            tick={{ fontSize: 12 }}
                          />
                          <ChartTooltip
                            formatter={(value, name) => {
                              const formatted = `$${Number(value || 0).toLocaleString()}`
                              if (name === "totalWealth") return [formatted, "Total Wealth"]
                              if (name === "endingBalance") return [formatted, "Liquid Assets"]
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
                          {displayProjection.yearlyProjections.find((y) => y.propertyLiquidated) && (
                            <ReferenceLine
                              x={displayProjection.yearlyProjections.find((y) => y.propertyLiquidated)?.age}
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              label={{ value: "Property Sold", position: "top", fontSize: 10, fill: "#8b5cf6" }}
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
                    planCurrency={planCurrency}
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
                    <button
                      onClick={() => setShowWhatIfModal(true)}
                      className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center justify-center"
                    >
                      <i className="fas fa-sliders-h mr-2"></i>
                      What-If Analysis
                    </button>
                    <button
                      onClick={() => setShowEditDetailsModal(true)}
                      className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <i className="fas fa-edit mr-2 text-orange-500"></i>
                      Edit Plan Details
                    </button>
                    {(scenarioHasChanges || hasScenarioOverrides || selectedScenarioIds.length > 0) && (
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
        onReset={resetWhatIf}
        retirementAge={retirementAge}
        monthlyInvestment={monthlyInvestment}
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
