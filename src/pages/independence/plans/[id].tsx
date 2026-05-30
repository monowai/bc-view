import React, { useState, useMemo, useEffect, useRef } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { Position } from "types/beancounter"
import { transformToAllocationSlices } from "@lib/allocation/aggregateHoldings"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  TabId,
  TABS,
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  INCOME_STREAM_CATEGORIES,
  useUnifiedProjection,
  RentalIncomeData,
  SaveScenarioDialog,
  EditPlanDetailsModal,
  MonteCarloTab,
  PlanViewHeader,
  PlanTabNavigation,
  DetailsTabContent,
  AssetsTabContent,
  TimelineTabContent,
  ScenarioBar,
} from "@components/features/independence"
import { useScenario } from "@components/features/independence/scenario/useScenario"
import {
  applyRealReturn,
  blendedReturnRate as computeBlendedReturnRate,
} from "@components/features/independence/scenario/scenarioToPayload"
import {
  defaultStrategyView,
  type StrategyView,
} from "@components/features/independence/strategyView"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import { useIndependencePlanData } from "@hooks/useIndependencePlanData"
import { useIndependencePlanCurrency } from "@hooks/useIndependencePlanCurrency"
import { useExcludedAssetIds } from "@hooks/useExcludedAssetIds"
import { useIndependencePlanProjections } from "@hooks/useIndependencePlanProjections"
import { useIndependenceSettings } from "@hooks/useIndependenceSettings"
import type { LumpSumAsset } from "@hooks/useIndependencePlanProjections"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import {
  parseManualAssets,
  parseExcludedPortfolioIds,
  parseExcludedRentalAssetIds,
  hasManualAssets,
  manualAssetsToSlices,
} from "@lib/independence/planHelpers"

function PlanView(): React.ReactElement {
  const router = useRouter()
  const { id } = router.query
  const { hideValues } = usePrivacyMode()
  const { settings: independenceSettings } = useIndependenceSettings()
  const hasAutoSelected = useRef(false)
  const hasCategoriesInitialized = useRef(false)
  const [activeTab, setActiveTab] = useState<TabId>("details")
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([])
  const [spendableCategories, setSpendableCategories] = useState<string[]>([])

  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Edit details modal state
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false)
  // Version counter to force modal re-initialization after save
  const [planVersion, setPlanVersion] = useState(0)

  // Data-fetching hooks
  const {
    plan,
    planError,
    isClientPlan,
    portfoliosData,
    holdingsData,
    refreshHoldings,
    isRefreshingHoldings,
    availableCurrencies,
    mutatePlan,
  } = useIndependencePlanData(id)

  // Unified scenario state — replaces the old WhatIfAdjustments + ScenarioOverrides
  // split. Drives the projection, Stress Test and Wealth-tab card.
  const {
    scenario,
    setScenario,
    reset: resetScenario,
    isDirty: scenarioIsDirty,
  } = useScenario(plan, independenceSettings)

  // Strategy view dropdown — seeded from the projection's effective strategy
  // once it arrives. Drives the ScenarioBar headline gauge order and the
  // FiMetrics section visibility on the Metrics tab.
  const [strategyView, setStrategyView] = useState<StrategyView | null>(null)

  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  const planCurrency = plan?.expensesCurrency || "NZD"

  // Fetch rental income from RE asset configs
  const { configs: assetConfigs, getNetRentalByCurrency } =
    usePrivateAssetConfigs()

  // Resolve asset IDs belonging to excluded portfolios (for rental income filtering)
  const excludedAssetIds = useExcludedAssetIds(
    plan?.excludedPortfolioIds,
    portfoliosData?.data,
  )

  // Display currency conversion
  const {
    displayCurrency,
    setDisplayCurrency,
    effectiveCurrency,
    effectiveFxRate,
  } = useIndependencePlanCurrency(planCurrency)

  // Get rental income by currency, filtering out assets from excluded portfolios
  const monthlyNetByCurrency = useMemo(() => {
    if (!assetConfigs || assetConfigs.length === 0) return {}
    return getNetRentalByCurrency(excludedAssetIds)
  }, [assetConfigs, getNetRentalByCurrency, excludedAssetIds])

  // Build rental income data for projections (backend fetches and converts from svc-data)
  // We no longer do FX conversion here - backend handles it
  const rentalIncome = useMemo((): RentalIncomeData | undefined => {
    if (Object.keys(monthlyNetByCurrency).length === 0) return undefined
    // Sum values without FX conversion (backend will fetch the correct values)
    const total = Object.values(monthlyNetByCurrency).reduce(
      (sum, val) => sum + val,
      0,
    )
    return {
      monthlyNetByCurrency,
      totalMonthlyInPlanCurrency: total, // Approximate - backend fetches accurate converted values
    }
  }, [monthlyNetByCurrency])

  // Effective plan values: the slider-driven scenario takes precedence over
  // the saved plan. Used by tabs that need a per-field view of the active
  // scenario (e.g. DetailsTabContent reading monthlyExpenses).
  const effectivePlanValues = useMemo(() => {
    if (!plan) return null
    const rates = applyRealReturn(scenario, plan)
    return {
      monthlyExpenses: scenario.monthlyExpenses,
      cashReturnRate: rates.cashReturnRate,
      equityReturnRate: rates.equityReturnRate,
      housingReturnRate: rates.housingReturnRate,
      inflationRate: scenario.inflation,
      pensionMonthly: scenario.pensionMonthly,
      // Slider-level merge: SS is folded into otherIncomeMonthly.
      socialSecurityMonthly: 0,
      otherIncomeMonthly: scenario.otherIncomeMonthly,
      targetBalance: plan.targetBalance,
      cashAllocation: plan.cashAllocation,
      equityAllocation: plan.equityAllocation,
      housingAllocation: plan.housingAllocation,
    }
  }, [plan, scenario])

  // Check if asset allocation sums to 100% (allowing 1% tolerance for rounding)
  // Note: allocations are stored as decimals (0.20 = 20%), so we compare against 1.0
  const allocationTotalDecimal = useMemo(() => {
    if (!plan) return 1.0
    return (
      (plan.cashAllocation ?? 0) +
      (plan.equityAllocation ?? 0) +
      (plan.housingAllocation ?? 0)
    )
  }, [plan])
  const allocationTotalPercent = Math.round(allocationTotalDecimal * 100)
  const isAllocationValid = Math.abs(allocationTotalDecimal - 1.0) <= 0.01

  // Filter to only show portfolios with non-zero balance
  const portfolios = useMemo(() => {
    return (portfoliosData?.data || []).filter(
      (p) => p.marketValue && p.marketValue !== 0,
    )
  }, [portfoliosData])

  // Determine if using manual assets (no portfolio holdings but plan has manual assets)
  const usingManualAssets = useMemo(() => {
    const holdingsEmpty =
      !holdingsData?.positions ||
      Object.keys(holdingsData.positions).length === 0
    return holdingsEmpty && hasManualAssets(plan?.manualAssets)
  }, [holdingsData, plan?.manualAssets])

  // Transform holdings into category slices (or use manual assets if no holdings)
  const categorySlices = useMemo(() => {
    const raw = (() => {
      // If user has manual assets and no portfolio holdings, use manual assets
      if (usingManualAssets) {
        const parsed = parseManualAssets(plan?.manualAssets)
        if (parsed) {
          return manualAssetsToSlices(parsed)
        }
      }
      // Otherwise use portfolio holdings
      if (!holdingsData) return []
      return transformToAllocationSlices(
        holdingsData,
        "category",
        ValueIn.PORTFOLIO,
      )
    })()
    // Retirement Fund holdings (CPF, SingLife etc.) already feed the
    // projection as income streams via svc-retire's PensionIncomeService —
    // showing them in Assets by Category invites the user to toggle them
    // spendable, which would double-count against the CPF LIFE annuity +
    // policy maturity already in the Income column.
    return raw.filter((s) => s.key !== "Retirement Fund")
  }, [holdingsData, usingManualAssets, plan?.manualAssets])

  // Auto-select all portfolios when data first loads
  useEffect(() => {
    if (portfolios.length > 0 && !hasAutoSelected.current) {
      const allIds = portfolios.map((p) => p.id)
      setSelectedPortfolioIds(allIds)
      hasAutoSelected.current = true
    }
  }, [portfolios])

  // Initialize spendable categories. Default = everything that is not
  // property-style non-spendable AND not an income-stream category whose
  // balance is already projected as a future income stream (CPF LIFE
  // annuity, policy maturity).
  useEffect(() => {
    if (
      categorySlices.length > 0 &&
      !hasCategoriesInitialized.current &&
      plan
    ) {
      const allCategories = categorySlices.map((s) => s.key)
      const spendable = allCategories.filter(
        (cat) =>
          !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(cat) &&
          !INCOME_STREAM_CATEGORIES.includes(cat),
      )
      setSpendableCategories(spendable)
      hasCategoriesInitialized.current = true
    }
  }, [categorySlices, plan])

  // Calculate total assets from category slices (for local display only)
  // Note: Backend fetches from svc-position with proper FX conversion for projection
  const totalAssets = useMemo(() => {
    return categorySlices.reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices])

  // Determine effective spendable categories for asset calculations
  // Before user initialization, use default (all except Property/Real Estate)
  // This ensures projection gets correct assets on first calculation
  const effectiveSpendableCategories = useMemo(() => {
    if (spendableCategories.length > 0) {
      return spendableCategories
    }
    // Before initialization, use default: everything except property-style
    // non-spendable AND income-stream categories (those flow to the
    // projection as scheduled income, not drawable principal).
    return categorySlices
      .map((s) => s.key)
      .filter(
        (cat) =>
          !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(cat) &&
          !INCOME_STREAM_CATEGORIES.includes(cat),
      )
  }, [spendableCategories, categorySlices])

  // Calculate liquid (spendable) assets - only selected categories (for local display)
  // Backend fetches from svc-position with proper FX conversion for projection
  const liquidAssets = useMemo(() => {
    return categorySlices
      .filter((slice) => effectiveSpendableCategories.includes(slice.key))
      .reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices, effectiveSpendableCategories])

  // Calculate non-spendable assets (e.g., property) (for local display)
  // Backend fetches from svc-position with proper FX conversion for projection
  const nonSpendableAssets = useMemo(() => {
    return categorySlices
      .filter((slice) => !effectiveSpendableCategories.includes(slice.key))
      .reduce((sum, slice) => sum + slice.value, 0)
  }, [categorySlices, effectiveSpendableCategories])

  // Determine if assets are loaded (for enabling asset-dependent tabs)
  const hasAssets = liquidAssets > 0 || nonSpendableAssets > 0

  // Default expected return rate for assets without a configured rate (3%)
  const DEFAULT_EXPECTED_RETURN = 0.03

  // Calculate weighted blended return rate from per-asset expected return rates
  const blendedReturnRate = useMemo(() => {
    // When using manual assets, calculate weighted rate based on effective rates
    if (usingManualAssets && effectivePlanValues) {
      const assets = parseManualAssets(plan?.manualAssets)
      if (assets) {
        const rateMap: Record<string, number> = {
          CASH: effectivePlanValues.cashReturnRate,
          EQUITY: effectivePlanValues.equityReturnRate,
          ETF: effectivePlanValues.equityReturnRate,
          MUTUAL_FUND: effectivePlanValues.equityReturnRate,
        }

        let totalValue = 0
        let weightedSum = 0

        for (const [category, value] of Object.entries(assets)) {
          if (value <= 0 || category === "RE") continue
          const rate = rateMap[category] ?? DEFAULT_EXPECTED_RETURN
          totalValue += value
          weightedSum += value * rate
        }

        if (totalValue > 0) {
          return weightedSum / totalValue
        }
      }
    }

    if (!holdingsData?.positions) {
      if (!effectivePlanValues) return DEFAULT_EXPECTED_RETURN
      return (
        effectivePlanValues.equityReturnRate *
          effectivePlanValues.equityAllocation +
        effectivePlanValues.cashReturnRate *
          effectivePlanValues.cashAllocation +
        effectivePlanValues.housingReturnRate *
          effectivePlanValues.housingAllocation
      )
    }

    let totalValue = 0
    let weightedSum = 0

    for (const positionKey of Object.keys(holdingsData.positions)) {
      const position = holdingsData.positions[positionKey]
      const moneyValues = position.moneyValues[ValueIn.PORTFOLIO]
      if (!moneyValues) continue

      const marketValue = moneyValues.marketValue || 0
      const reportCategory =
        position.asset.effectiveReportCategory ||
        position.asset.assetCategory?.name ||
        "Equity"
      if (DEFAULT_NON_SPENDABLE_CATEGORIES.includes(reportCategory)) continue

      const rate = position.asset.expectedReturnRate ?? DEFAULT_EXPECTED_RETURN
      totalValue += marketValue
      weightedSum += marketValue * rate
    }

    return totalValue > 0 ? weightedSum / totalValue : DEFAULT_EXPECTED_RETURN
  }, [holdingsData, plan?.manualAssets, effectivePlanValues, usingManualAssets])

  // Derive age values from user-level independence settings
  const currentYear = new Date().getFullYear()
  const currentAge = independenceSettings?.yearOfBirth
    ? currentYear - independenceSettings.yearOfBirth
    : undefined

  const lifeExpectancy = independenceSettings?.lifeExpectancy ?? 90

  // Use settings targetIndependenceAge, falling back to plan-derived value
  const retirementAge =
    independenceSettings?.targetIndependenceAge ??
    (plan?.planningHorizonYears
      ? lifeExpectancy - plan.planningHorizonYears
      : 65)

  // Identify pension/policy assets with lump sum settings for FV projection
  const lumpSumAssets = useMemo((): LumpSumAsset[] => {
    if (!assetConfigs || !holdingsData?.positions) return []
    const positions = Object.values(holdingsData.positions) as Position[]
    return assetConfigs
      .filter((config) => config.isPension && config.lumpSum)
      .map((config) => {
        const position = positions.find((p) => p.asset.id === config.assetId)
        const moneyValues = position?.moneyValues?.[ValueIn.PORTFOLIO]
        const category =
          position?.asset.effectiveReportCategory ||
          position?.asset.assetCategory?.name ||
          "Policy"
        return {
          config,
          assetName: position?.asset.name || config.assetId,
          currentValue: moneyValues?.marketValue || 0,
          category,
        }
      })
      .filter((item) => item.currentValue > 0)
  }, [assetConfigs, holdingsData])

  // Fetch FV projections for lump sum pension/policy assets
  const { pensionProjections } = useIndependencePlanProjections(
    lumpSumAssets,
    currentAge,
    planCurrency,
  )

  // Calculate FV adjustment for pension/policy assets based on category selection
  const excludedPensionFV = useMemo(() => {
    return pensionProjections
      .filter((p) => !effectiveSpendableCategories.includes(p.category))
      .reduce((sum, p) => sum + p.projectedValue, 0)
  }, [pensionProjections, effectiveSpendableCategories])

  // Calculate the FV differential for included pension/policy assets
  const includedPensionFvDifferential = useMemo(() => {
    return pensionProjections
      .filter((p) => effectiveSpendableCategories.includes(p.category))
      .reduce((sum, p) => sum + (p.projectedValue - p.currentValue), 0)
  }, [pensionProjections, effectiveSpendableCategories])

  // Calculate pre-retirement contributions (for passing to backend)
  const effectiveNetIncome =
    (plan?.workingIncomeMonthly ?? 0) +
    (plan?.bonusMonthly ?? 0) -
    (plan?.taxesMonthly ?? 0)
  const monthlySurplus =
    effectiveNetIncome - (plan?.workingExpensesMonthly || 0)
  const monthlyInvestment =
    monthlySurplus > 0
      ? monthlySurplus * (plan?.investmentAllocationPercent || 0.8)
      : 0

  // Use unified projection hook
  const {
    adjustedProjection,
    baselineProjection,
    isCalculating,
    resetProjection,
  } = useUnifiedProjection({
    plan,
    assets: {
      liquidAssets,
      nonSpendableAssets,
      totalAssets,
      hasAssets,
    },
    selectedPortfolioIds,
    monthlyInvestment,
    scenario,
    isAtBaseline: !scenarioIsDirty,
    rentalIncome,
    displayCurrency: displayCurrency ?? undefined,
  })

  // FIRE data is ready when backend projection has completed with valid metrics
  const fireDataReady =
    !!plan &&
    !!adjustedProjection?.fiMetrics &&
    isAllocationValid &&
    !isCalculating

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
      if (!response.ok) return
      const result = await response.json()
      const exportData = result.data
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      })
      const fileName = `${plan.name.replace(/[^a-z0-9]/gi, "_")}_retirement_plan.json`

      const downloadFallback = (): void => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (
            window as never as {
              showSaveFilePicker: (
                opts: Record<string, unknown>,
              ) => Promise<FileSystemFileHandle>
            }
          ).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "JSON",
                accept: { "application/json": [".json"] },
              },
            ],
          })
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
        } catch (pickerErr) {
          if (
            pickerErr instanceof DOMException &&
            pickerErr.name === "AbortError" &&
            pickerErr.message.includes("user aborted")
          )
            return
          downloadFallback()
        }
      } else {
        downloadFallback()
      }
    } catch (err) {
      console.error("Failed to export plan:", err)
    }
  }

  const handleTransfer = async (): Promise<void> => {
    if (!plan || !isClientPlan) return
    setIsTransferring(true)
    setTransferError(null)
    try {
      const response = await fetch(
        `/api/independence/plans/${plan.id}/transfer`,
        { method: "POST" },
      )
      if (response.ok) {
        router.push("/independence")
      } else {
        const errorData = await response.json().catch(() => ({}))
        setTransferError(errorData.message || "Failed to transfer plan")
      }
    } catch (err) {
      console.error("Failed to transfer plan:", err)
      setTransferError("Failed to transfer plan")
    } finally {
      setIsTransferring(false)
    }
  }

  // EditPlanDetailsModal still emits an old ScenarioOverrides shape; bridge
  // those edits into the unified scenario state so the modal keeps working.
  const handleApplyDetails = (overrides: {
    monthlyExpenses?: number
    pensionMonthly?: number
    socialSecurityMonthly?: number
    otherIncomeMonthly?: number
    inflationRate?: number
  }): void => {
    setScenario({
      ...(overrides.monthlyExpenses != null && {
        monthlyExpenses: overrides.monthlyExpenses,
      }),
      ...(overrides.pensionMonthly != null && {
        pensionMonthly: overrides.pensionMonthly,
      }),
      ...((overrides.socialSecurityMonthly != null ||
        overrides.otherIncomeMonthly != null) && {
        otherIncomeMonthly:
          (overrides.otherIncomeMonthly ?? 0) +
          (overrides.socialSecurityMonthly ?? 0),
      }),
      ...(overrides.inflationRate != null && {
        inflation: overrides.inflationRate,
      }),
    })
    setShowEditDetailsModal(false)
  }

  // Save scenario to backend (update existing or create new plan). Maps the
  // unified ScenarioState back into the plan-shaped fields the backend
  // PlanRequest expects. Liquid assets, currentAge and lifeExpectancy are
  // NOT persisted via this path — they live on holdings + UserSettings.
  const handleSaveScenario = async (
    mode: "update" | "new",
    newPlanName?: string,
  ): Promise<void> => {
    if (!plan) return
    setIsSaving(true)
    try {
      const rates = applyRealReturn(scenario, plan)
      const updates = {
        name: plan.name,
        monthlyExpenses: scenario.monthlyExpenses,
        pensionMonthly: scenario.pensionMonthly,
        // Slider-level merge: SS is folded into otherIncomeMonthly. We zero
        // socialSecurityMonthly so the backend sees a single stream.
        socialSecurityMonthly: 0,
        benefitsStartAge: plan.benefitsStartAge,
        otherIncomeMonthly: scenario.otherIncomeMonthly,
        inflationRate: scenario.inflation,
        targetBalance: plan.targetBalance,
        equityReturnRate: rates.equityReturnRate,
        cashReturnRate: rates.cashReturnRate,
        housingReturnRate: rates.housingReturnRate,
        equityAllocation: plan.equityAllocation,
        cashAllocation: plan.cashAllocation,
        housingAllocation: plan.housingAllocation,
        excludedPortfolioIds: parseExcludedPortfolioIds(
          plan.excludedPortfolioIds,
        ),
        excludedRentalAssetIds: parseExcludedRentalAssetIds(
          plan.excludedRentalAssetIds,
        ),
      }

      if (mode === "update") {
        const response = await fetch(`/api/independence/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (response.ok) {
          const updatedPlan = await response.json()
          await mutatePlan(updatedPlan, false)
          resetScenario()
          setShowSaveDialog(false)
          setPlanVersion((v) => v + 1)
        }
      } else {
        const copyName = newPlanName || `${plan.name} (Scenario)`
        const copyResponse = await fetch(
          `/api/independence/plans/${plan.id}/copy`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: copyName }),
          },
        )
        if (copyResponse.ok) {
          const copyResult = await copyResponse.json()
          const newPlanId = copyResult.data.id
          const patchResponse = await fetch(
            `/api/independence/plans/${newPlanId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            },
          )
          if (!patchResponse.ok) {
            console.error("Failed to apply scenario overrides to copied plan")
          }
          resetScenario()
          setShowSaveDialog(false)
          router.push(`/independence/plans/${newPlanId}`)
        }
      }
    } catch (err) {
      console.error("Failed to save scenario:", err)
    } finally {
      setIsSaving(false)
    }
  }

  if (planError) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <Alert>Failed to load plan. Please try again.</Alert>
        </div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center">
          <Spinner label="Loading plan..." size="lg" />
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{plan.name} | Independence Planning | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-4">
        <div className="container mx-auto px-4">
          {/* Compact Header */}
          <PlanViewHeader
            planName={plan.name}
            planId={plan.id}
            planningHorizonYears={plan.planningHorizonYears}
            planCurrency={planCurrency}
            displayCurrency={displayCurrency}
            availableCurrencies={availableCurrencies}
            onCurrencyChange={setDisplayCurrency}
            onExport={handleExport}
          />

          {/* Client Plan Banner */}
          {isClientPlan && (
            <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fas fa-user-tie text-blue-600"></i>
                <span className="text-sm text-blue-800">
                  {"Managing for client"}: {plan.clientId}
                </span>
              </div>
              <button
                onClick={handleTransfer}
                disabled={isTransferring}
                className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isTransferring ? "Transferring..." : "Transfer to Client"}
              </button>
            </div>
          )}
          {transferError && (
            <div className="mb-4">
              <Alert>{transferError}</Alert>
            </div>
          )}

          {/* Loading Overlay - shown during initial projection calculation */}
          {isCalculating && !adjustedProjection && (
            <div className="fixed inset-0 bg-white/80 z-40 flex items-center justify-center">
              <div className="text-center">
                <Spinner label="Calculating projections..." size="lg" />
                <p className="text-gray-400 text-sm mt-1">
                  Fetching assets and running calculations
                </p>
              </div>
            </div>
          )}

          {/* Allocation Warning Banner */}
          {!isAllocationValid && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <i className="fas fa-exclamation-triangle text-red-600 mt-0.5"></i>
                <div>
                  <p className="font-medium text-red-800">
                    Invalid Asset Allocation
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    Your asset allocation totals {allocationTotalPercent}% but
                    must equal 100%. Projections are disabled until this is
                    corrected.{" "}
                    <Link
                      href={`/independence/wizard/${plan.id}`}
                      className="underline font-medium hover:text-red-900"
                    >
                      Edit plan to fix
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sticky scenario panel — drives projection, Stress Test and the
              Wealth-tab card. Replaces the old What-If modal + summary bar. */}
          {plan && (
            <ScenarioBar
              scenario={scenario}
              onScenarioChange={setScenario}
              onReset={resetScenario}
              onSave={() => setShowSaveDialog(true)}
              isDirty={scenarioIsDirty}
              currency={effectiveCurrency}
              fiMetrics={adjustedProjection?.fiMetrics}
              view={
                strategyView ??
                defaultStrategyView(adjustedProjection?.effectiveStrategy)
              }
              onViewChange={setStrategyView}
              derivedLiquidAssets={liquidAssets}
              planBlendedReturn={computeBlendedReturnRate(plan)}
              planInflation={plan.inflationRate}
            />
          )}

          {/* Tab Navigation */}
          <PlanTabNavigation
            activeTab={activeTab}
            onTabChange={setActiveTab}
            hasAssets={hasAssets}
          />

          {/* Tab Byline */}
          {(() => {
            const activeTabConfig = TABS.find((t) => t.id === activeTab)
            return activeTabConfig?.byline ? (
              <p className="text-sm text-gray-500 mb-4">
                {activeTabConfig.byline}
              </p>
            ) : null
          })()}

          {/* Tab Content */}
          {activeTab === "details" && (
            <DetailsTabContent
              plan={plan}
              scenario={scenario}
              projection={adjustedProjection}
              rentalIncome={rentalIncome}
              effectiveCurrency={effectiveCurrency}
              planCurrency={planCurrency}
              onEditDetails={() => setShowEditDetailsModal(true)}
              categorySlices={categorySlices}
              spendableCategories={spendableCategories}
              onToggleCategory={toggleCategory}
              pensionProjections={pensionProjections}
              totalAssets={totalAssets}
              liquidAssets={liquidAssets}
              blendedReturnRate={blendedReturnRate}
              currentAge={currentAge}
              retirementAge={retirementAge}
              effectiveFxRate={effectiveFxRate}
              isCalculating={isCalculating}
              holdingsLoaded={!!holdingsData}
              usingManualAssets={usingManualAssets}
              isRefreshingHoldings={isRefreshingHoldings}
              onRefreshHoldings={() => refreshHoldings()}
              excludedPensionFV={excludedPensionFV}
              includedPensionFvDifferential={includedPensionFvDifferential}
            />
          )}

          {activeTab === "assets" && (
            <AssetsTabContent
              projection={adjustedProjection}
              effectivePlanValues={effectivePlanValues}
              blendedReturnRate={blendedReturnRate}
              currentAge={currentAge}
              retirementAge={retirementAge}
              effectiveCurrency={effectiveCurrency}
              fireDataReady={fireDataReady}
              view={
                strategyView ??
                defaultStrategyView(adjustedProjection?.effectiveStrategy)
              }
            />
          )}

          {activeTab === "timeline" && (
            <TimelineTabContent
              projection={adjustedProjection}
              baselineProjection={baselineProjection}
              retirementAge={retirementAge}
              lifeExpectancy={lifeExpectancy}
              hideValues={hideValues}
              isCalculating={isCalculating}
              effectiveCurrency={effectiveCurrency}
            />
          )}

          {/* Simulation Tab - Monte Carlo Analysis */}
          {activeTab === "simulation" && (
            <MonteCarloTab
              plan={plan}
              assets={{
                liquidAssets,
                nonSpendableAssets,
                totalAssets,
                hasAssets,
              }}
              monthlyInvestment={monthlyInvestment}
              scenario={scenario}
              rentalIncome={rentalIncome}
              displayCurrency={displayCurrency ?? undefined}
              hideValues={hideValues}
              currency={effectiveCurrency}
              displayProjection={adjustedProjection}
            />
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

      {/* Edit Details Modal - conditionally mounted so each open starts
          with fresh form state derived from the current plan. */}
      {showEditDetailsModal && (
        <EditPlanDetailsModal
          key={`edit-modal-v${planVersion}`}
          onClose={() => setShowEditDetailsModal(false)}
          onApply={handleApplyDetails}
          plan={plan}
        />
      )}
    </>
  )
}

export default withPageAuthRequired(PlanView)
