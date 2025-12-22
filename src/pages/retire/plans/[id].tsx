import React, { useState, useMemo, useEffect, useRef } from "react"
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

// Default non-spendable categories (property typically can't be easily liquidated)
const DEFAULT_NON_SPENDABLE = ["Property"]

type TabId = "details" | "assets" | "projection" | "timeline"

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "details", label: "Plan Details", icon: "fa-clipboard-list" },
  { id: "assets", label: "Assets", icon: "fa-wallet" },
  { id: "projection", label: "Projection", icon: "fa-calculator" },
  { id: "timeline", label: "Timeline", icon: "fa-chart-line" },
]

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
  const yearsToRetirement =
    currentAge !== undefined ? Math.max(0, retirementAge - currentAge) : 0

  const handleCalculateProjection = async (): Promise<void> => {
    if (!plan || liquidAssets === 0) return

    setIsCalculating(true)
    try {
      const response = await fetch(`/api/retire/projection/${plan.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Current assets - backend will calculate FV
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
  }

  const handleExport = async (): Promise<void> => {
    if (!plan) return

    try {
      const response = await fetch(`/api/retire/plans/${plan.id}/export`)
      if (response.ok) {
        const result = await response.json()
        const exportData = result.data

        // Create and download the file
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
  // We intentionally omit handleCalculateProjection from deps to avoid re-triggering on function identity changes
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, liquidAssets, spendableCategories, projection])

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

  return (
    <>
      <Head>
        <title>{plan.name} | Retirement Planning | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <Link
              href="/retire"
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Plans
            </Link>
          </div>

          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {plan.name}
              </h1>
              <p className="text-gray-600">
                {plan.planningHorizonYears} year planning horizon
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExport}
                className="text-gray-600 hover:text-gray-700 font-medium"
                title="Download plan as JSON"
              >
                <i className="fas fa-download mr-2"></i>
                Export
              </button>
              <Link
                href={`/retire/wizard/${plan.id}`}
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                <i className="fas fa-edit mr-2"></i>
                Edit Plan
              </Link>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm flex items-center
                    ${
                      activeTab === tab.id
                        ? "border-orange-500 text-orange-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <i className={`fas ${tab.icon} mr-2`}></i>
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
                  {/* Category list with checkboxes */}
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

                  {/* Summary */}
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <InfoTooltip
                        text={t("retire.assets.totalAssets.tooltip")}
                      >
                        <span className="text-gray-500">
                          {t("retire.assets.totalAssets")}
                        </span>
                      </InfoTooltip>
                      <span className="font-medium">
                        ${Math.round(totalAssets).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <InfoTooltip text={t("retire.assets.spendable.tooltip")}>
                        <span className="text-gray-500">
                          {t("retire.assets.spendable")}
                        </span>
                      </InfoTooltip>
                      <span className="font-medium text-orange-600">
                        ${Math.round(liquidAssets).toLocaleString()}
                      </span>
                    </div>
                    {totalAssets > liquidAssets && (
                      <div className="flex justify-between text-sm">
                        <InfoTooltip
                          text={t("retire.assets.nonSpendable.tooltip")}
                        >
                          <span className="text-gray-500">
                            {t("retire.assets.nonSpendable")}
                          </span>
                        </InfoTooltip>
                        <span className="font-medium text-gray-400">
                          $
                          {Math.round(
                            totalAssets - liquidAssets,
                          ).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Pre-retirement Growth - uses backend calculations when available */}
                  {projection?.preRetirementAccumulation &&
                    projection.preRetirementAccumulation.yearsToRetirement >
                      0 && (
                      <div className="border-t pt-4 space-y-2">
                        <div className="text-sm text-gray-500 font-medium">
                          {t("retire.assets.preRetirement", {
                            years:
                              projection.preRetirementAccumulation
                                .yearsToRetirement,
                            rate: (
                              projection.preRetirementAccumulation
                                .blendedReturnRate * 100
                            ).toFixed(1),
                          })}
                        </div>

                        {/* Growth of existing assets */}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {t("retire.assets.currentLiquid")}
                          </span>
                          <span className="font-medium">
                            $
                            {Math.round(
                              projection.preRetirementAccumulation
                                .currentLiquidAssets,
                            ).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 pl-4">
                            {t("retire.assets.growthOverYears", {
                              years:
                                projection.preRetirementAccumulation
                                  .yearsToRetirement,
                            })}
                          </span>
                          <span className="font-medium text-green-600">
                            + $
                            {Math.round(
                              projection.preRetirementAccumulation
                                .growthOnExistingAssets,
                            ).toLocaleString()}
                          </span>
                        </div>

                        {/* Contributions */}
                        {projection.preRetirementAccumulation
                          .monthlyContribution > 0 && (
                          <>
                            <div className="flex justify-between text-sm mt-2">
                              <span className="text-gray-500">
                                {t("retire.assets.monthlyInvestment")}
                              </span>
                              <span className="font-medium">
                                $
                                {Math.round(
                                  projection.preRetirementAccumulation
                                    .monthlyContribution,
                                ).toLocaleString()}{" "}
                                ×{" "}
                                {projection.preRetirementAccumulation
                                  .yearsToRetirement * 12}{" "}
                                months
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500 pl-4">
                                {t("retire.assets.contributionsReturns")}
                              </span>
                              <span className="font-medium text-green-600">
                                + $
                                {Math.round(
                                  projection.preRetirementAccumulation
                                    .futureValueOfContributions,
                                ).toLocaleString()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                  {/* Fallback: show basic info while calculating */}
                  {!projection?.preRetirementAccumulation &&
                    yearsToRetirement > 0 && (
                      <div className="border-t pt-4 space-y-2">
                        <div className="text-sm text-gray-500 font-medium">
                          {t("retire.assets.preRetirement", {
                            years: yearsToRetirement,
                            rate: "?",
                          })}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">
                            {t("retire.assets.currentLiquid")}
                          </span>
                          <span className="font-medium">
                            ${Math.round(liquidAssets).toLocaleString()}
                          </span>
                        </div>
                        {monthlyInvestment > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">
                              {t("retire.assets.monthlyInvestment")}
                            </span>
                            <span className="font-medium">
                              ${Math.round(monthlyInvestment).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  {/* Starting Balance at Retirement */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between font-medium text-lg">
                      <InfoTooltip
                        text={t("retire.assets.spendableAtRetirement.tooltip")}
                      >
                        <span>{t("retire.assets.spendableAtRetirement")}</span>
                      </InfoTooltip>
                      <span className="text-orange-600">
                        $
                        {Math.round(
                          projection?.liquidAssets || liquidAssets,
                        ).toLocaleString()}
                      </span>
                    </div>
                    {currentAge !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        {t("retire.assets.retirementInfo", {
                          currentAge,
                          retirementAge,
                          yearsToRetirement,
                        })}
                      </p>
                    )}
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
              {!projection ? (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-chart-line text-4xl mb-3 text-gray-300"></i>
                  <p>{t("retire.projection.calculate")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Key Summary */}
                  {projection.depletionAge && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm text-blue-600 font-medium mb-2">
                        {t("retire.projection.timeline", {
                          age: retirementAge,
                        })}
                      </p>
                      <div className="space-y-1 text-sm text-blue-800">
                        <p>
                          <InfoTooltip
                            text={t(
                              "retire.projection.startingBalance.tooltip",
                            )}
                          >
                            <span className="font-medium">
                              {t("retire.projection.startingBalance")}:
                            </span>
                          </InfoTooltip>{" "}
                          {planCurrency}{" "}
                          {Math.round(projection.liquidAssets).toLocaleString()}
                        </p>
                        {projection.nonSpendableAtRetirement > 0 && (
                          <p>
                            <InfoTooltip
                              text={t(
                                "retire.projection.propertyValue.tooltip",
                              )}
                            >
                              <span className="font-medium">
                                {t("retire.projection.propertyValue")}:
                              </span>
                            </InfoTooltip>{" "}
                            {planCurrency}{" "}
                            {Math.round(
                              projection.nonSpendableAtRetirement,
                            ).toLocaleString()}
                          </p>
                        )}
                        <p>
                          <InfoTooltip
                            text={t(
                              "retire.projection.supportUntilAge.tooltip",
                            )}
                          >
                            <span className="font-medium">
                              {t("retire.projection.supportUntilAge")}:
                            </span>
                          </InfoTooltip>{" "}
                          {projection.depletionAge}
                        </p>
                        <p>
                          <InfoTooltip
                            text={t("retire.projection.yearsOfRunway.tooltip")}
                          >
                            <span className="font-medium">
                              {t("retire.projection.yearsOfRunway")}:
                            </span>
                          </InfoTooltip>{" "}
                          {projection.runwayYears.toFixed(1)} years
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Runway Details */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <InfoTooltip
                      text={t("retire.projection.howLongAssetsLast.tooltip")}
                    >
                      <p className="text-sm text-orange-600 font-medium">
                        {t("retire.projection.howLongAssetsLast")}
                      </p>
                    </InfoTooltip>
                    <p className="text-3xl font-bold text-orange-700">
                      {projection.runwayYears.toFixed(1)} years
                    </p>
                    <p className="text-xs text-orange-600 mt-2">
                      {t("retire.projection.runwayDescription", {
                        currency: planCurrency,
                        expenses: Math.round(
                          projection.monthlyExpenses,
                        ).toLocaleString(),
                      })}
                    </p>
                  </div>

                  {/* Depletion Age */}
                  {projection.depletionAge && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <InfoTooltip
                        text={t("retire.projection.fundsDepletedAtAge.tooltip")}
                      >
                        <p className="text-sm text-gray-600">
                          {t("retire.projection.fundsDepletedAtAge")}
                        </p>
                      </InfoTooltip>
                      <p className="text-2xl font-bold text-gray-900">
                        {projection.depletionAge}
                      </p>
                      {plan.planningHorizonYears &&
                        currentAge !== undefined && (
                          <p className="text-xs text-gray-500 mt-1">
                            {t("retire.projection.planHorizon", {
                              age: currentAge + plan.planningHorizonYears,
                            })}
                          </p>
                        )}
                    </div>
                  )}

                  {/* Surplus/Deficit vs Target */}
                  {projection.surplusOrDeficit != null &&
                    projection.targetBalance != null && (
                      <div
                        className={`rounded-lg p-4 ${
                          projection.surplusOrDeficit >= 0
                            ? "bg-green-50"
                            : "bg-red-50"
                        }`}
                      >
                        <InfoTooltip
                          text={t("retire.projection.surplusDeficit.tooltip")}
                        >
                          <p
                            className={`text-sm font-medium ${
                              projection.surplusOrDeficit >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {projection.surplusOrDeficit >= 0
                              ? t("retire.projection.surplus")
                              : t("retire.projection.deficit")}{" "}
                            {t("retire.projection.vsTarget")}
                          </p>
                        </InfoTooltip>
                        <p
                          className={`text-2xl font-bold ${
                            projection.surplusOrDeficit >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {planCurrency}{" "}
                          {Math.abs(
                            projection.surplusOrDeficit,
                          ).toLocaleString()}
                        </p>
                        <div className="text-xs text-gray-500 mt-2 space-y-1">
                          <p>
                            <InfoTooltip
                              text={t("retire.targetBalance.tooltip")}
                            >
                              <span className="font-medium">
                                {t("retire.targetBalance")}:
                              </span>
                            </InfoTooltip>{" "}
                            {planCurrency}{" "}
                            {projection.targetBalance.toLocaleString()}
                          </p>
                          <p>
                            <InfoTooltip
                              text={t(
                                "retire.projection.projectedFinalBalance.tooltip",
                              )}
                            >
                              <span className="font-medium">
                                {t("retire.projection.projectedFinalBalance")}:
                              </span>
                            </InfoTooltip>{" "}
                            {planCurrency}{" "}
                            {Math.round(
                              projection.yearlyProjections[
                                projection.yearlyProjections.length - 1
                              ]?.endingBalance || 0,
                            ).toLocaleString()}
                          </p>
                        </div>
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

              {/* Summary: Show key projection parameters from backend */}
              {projection && projection.yearlyProjections.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.startAge")}:
                      </span>{" "}
                      <span className="font-medium">
                        {projection.yearlyProjections[0]?.age || retirementAge}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.liquidAssets")}:
                      </span>{" "}
                      <span className="font-medium">
                        $
                        {Math.round(
                          projection.yearlyProjections[0]?.startingBalance || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.property")}:
                      </span>{" "}
                      <span className="font-medium">
                        $
                        {Math.round(
                          projection.yearlyProjections[0]?.nonSpendableValue ||
                            0,
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.totalWealth")}:
                      </span>{" "}
                      <span className="font-medium text-blue-600">
                        $
                        {Math.round(
                          projection.yearlyProjections[0]?.totalWealth || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.endAge")}:
                      </span>{" "}
                      <span className="font-medium">
                        {projection.yearlyProjections[
                          projection.yearlyProjections.length - 1
                        ]?.age || "-"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.liquidAssets")}:
                      </span>{" "}
                      <span className="font-medium">
                        $
                        {Math.round(
                          projection.yearlyProjections[
                            projection.yearlyProjections.length - 1
                          ]?.endingBalance || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.property")}:
                      </span>{" "}
                      <span className="font-medium text-green-600">
                        $
                        {Math.round(
                          projection.yearlyProjections[
                            projection.yearlyProjections.length - 1
                          ]?.nonSpendableValue || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">
                        {t("retire.timeline.totalWealth")}:
                      </span>{" "}
                      <span className="font-medium text-blue-600">
                        $
                        {Math.round(
                          projection.yearlyProjections[
                            projection.yearlyProjections.length - 1
                          ]?.totalWealth || 0,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!projection || projection.yearlyProjections.length === 0 ? (
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
                  {/* Balance Chart */}
                  <div className="h-72 mb-8">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {t("retire.timeline.portfolioBalance")}
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={projection.yearlyProjections}
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
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
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
                        {plan?.targetBalance && (
                          <ReferenceLine
                            y={plan.targetBalance}
                            stroke="#22c55e"
                            strokeDasharray="5 5"
                          />
                        )}
                        {/* Total Wealth line (includes property) */}
                        {projection.nonSpendableAtRetirement > 0 && (
                          <Line
                            type="monotone"
                            dataKey="totalWealth"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ r: 2, fill: "#3b82f6" }}
                            name="totalWealth"
                          />
                        )}
                        {/* Liquid assets line */}
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

                  {/* Cash Flow Chart */}
                  <div className="h-64">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      {t("retire.timeline.cashFlows")}
                    </h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={projection.yearlyProjections.map((y) => ({
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
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                          }}
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

              {/* Legend for Balance Chart */}
              {projection && projection.yearlyProjections.length > 0 && (
                <div className="mt-2 mb-4 flex justify-center gap-6 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-orange-600"></div>
                    <span>{t("retire.timeline.liquidAssets")}</span>
                  </div>
                  {projection.nonSpendableAtRetirement > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-blue-500"></div>
                      <span>{t("retire.timeline.totalWealth")}</span>
                    </div>
                  )}
                  {plan?.targetBalance && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-0.5 bg-green-500"></div>
                      <span>{t("retire.timeline.target")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-0.5 bg-red-500"></div>
                    <span>{t("retire.timeline.zero")}</span>
                  </div>
                </div>
              )}

              {/* Collapsible Data Table */}
              {projection && projection.yearlyProjections.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    {t("retire.timeline.viewData")}
                  </summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-3">
                            {t("retire.timeline.age")}
                          </th>
                          <th className="text-right py-2 px-3">
                            {t("retire.timeline.liquidStart")}
                          </th>
                          <th className="text-right py-2 px-3">
                            {t("retire.timeline.returns")}
                          </th>
                          <th className="text-right py-2 px-3">
                            {t("retire.timeline.withdrawals")}
                          </th>
                          <th className="text-right py-2 px-3">
                            {t("retire.timeline.liquidEnd")}
                          </th>
                          {projection.nonSpendableAtRetirement > 0 && (
                            <>
                              <th className="text-right py-2 px-3 text-green-700">
                                {t("retire.timeline.property")}
                              </th>
                              <th className="text-right py-2 px-3 text-blue-700">
                                {t("retire.timeline.totalWealth")}
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {projection.yearlyProjections.map((year) => (
                          <tr key={year.year} className="border-b">
                            <td className="py-2 px-3">{year.age || "-"}</td>
                            <td className="text-right py-2 px-3">
                              $
                              {Math.round(
                                year.startingBalance,
                              ).toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-3 text-green-600">
                              +${Math.round(year.investment).toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-3 text-red-600">
                              -${Math.round(year.withdrawals).toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-3 font-medium">
                              ${Math.round(year.endingBalance).toLocaleString()}
                            </td>
                            {projection.nonSpendableAtRetirement > 0 && (
                              <>
                                <td className="text-right py-2 px-3 text-green-700">
                                  $
                                  {Math.round(
                                    year.nonSpendableValue,
                                  ).toLocaleString()}
                                </td>
                                <td className="text-right py-2 px-3 font-medium text-blue-700">
                                  $
                                  {Math.round(
                                    year.totalWealth,
                                  ).toLocaleString()}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
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
