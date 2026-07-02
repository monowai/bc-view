import React, { useState, useMemo, useEffect, useRef } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import { Position } from "types/beancounter"
import {
  serverBreakdownToAllocationSlices,
  transformToAllocationSlices,
} from "@lib/allocation/aggregateHoldings"
import { getReportCategory } from "@lib/categoryMapping"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  TabId,
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
  AssetsBreakdown,
  TimelineTabContent,
  PlanFiOverviewTab,
  AssumptionsPanel,
} from "@components/features/independence"
import { useScenario } from "@components/features/independence/scenario/useScenario"
import { applyRealReturn } from "@components/features/independence/scenario/scenarioToPayload"
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
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type { PlansResponse } from "types/independence"
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
import { buildCpfSubAccountRows } from "@lib/independence/cpfSubAccountTags"

function PlanView(): React.ReactElement {
  const router = useRouter()
  const { id } = router.query
  const { hideValues } = usePrivacyMode()
  const { settings: independenceSettings } = useIndependenceSettings()
  const hasAutoSelected = useRef(false)
  const hasCategoriesInitialized = useRef(false)
  // Land on "My Plan" by default — the FI Overview is only the home tab for
  // FIRE-strategy plans (see resolvedStrategyView / showFiTab below).
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

  // Pull the sharedPlanIds set so we can detect when this plan belongs to
  // someone else (accepted resource share). Shared plans route the
  // projection through svc-retire's M2M / ?systemUserId path so the
  // viewer's own holdings don't pollute the result.
  const { data: plansData } = useSwr<PlansResponse>(
    "/api/independence/plans",
    simpleFetcher("/api/independence/plans"),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  )
  // True once plansData has resolved — until then we can't tell whether
  // the plan is owned or shared, and firing the projection prematurely
  // sends a viewer-scoped payload that pollutes svc-retire's response.
  // On a hard refresh of a shared plan that meant the first render
  // would briefly show the viewer's data before plansData arrived.
  const isSharedPlanResolved = plansData?.data != null
  const isSharedPlan = useMemo(() => {
    const idStr = Array.isArray(id) ? id[0] : id
    if (!idStr) return false
    return (plansData?.sharedPlanIds ?? []).includes(idStr)
  }, [plansData, id])
  // Owner's SystemUser.id from the shared plan row. Drives the owner-
  // scoped portfolio filter on the holdings SWR — when set, the
  // Assets-by-Category panel renders the plan owner's categories (via
  // accepted portfolio shares), not the viewer's. Null until the
  // backfill on svc-retire has populated `plan.systemUserId`.
  const sharedPlanOwnerSystemUserId = useMemo(() => {
    if (!isSharedPlan) return undefined
    const idStr = Array.isArray(id) ? id[0] : id
    const match = plansData?.data?.find((p) => p.id === idStr)
    return match?.systemUserId ?? undefined
  }, [isSharedPlan, plansData, id])

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
  } = useIndependencePlanData(id, sharedPlanOwnerSystemUserId)

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

  // Pending exclusion edits from EditPlanDetailsModal. Exclusions aren't
  // part of ScenarioState (they're plan-level filters, not what-if levers),
  // so we hold them here between modal-apply and save.
  const [pendingExclusions, setPendingExclusions] = useState<{
    excludedPortfolioIds?: string[]
    excludedRentalAssetIds?: string[]
  } | null>(null)

  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  const planCurrency = plan?.expensesCurrency || "NZD"

  // Fetch rental income from RE asset configs
  const {
    configs: assetConfigs,
    assetNames: assetConfigNames,
    getNetRentalByCurrency,
  } = usePrivateAssetConfigs()

  // CPF sub-account breakdown rows — empty when the user has no CPF policy,
  // so the panel hides for non-Singaporean plans.
  const cpfSubAccountRows = useMemo(
    () => buildCpfSubAccountRows(assetConfigs, assetConfigNames),
    [assetConfigs, assetConfigNames],
  )

  // Group sub-account rows under the category-slice key their CPF parent
  // resolves to via getReportCategory. Lets AssetsBreakdown expand the
  // parent slice (e.g. "Retirement Fund") with indented child rows.
  const cpfSubAccountsByCategoryKey = useMemo<
    Record<string, typeof cpfSubAccountRows>
  >(() => {
    if (cpfSubAccountRows.length === 0) return {}
    if (!holdingsData?.positions) return {}
    const parentIds = new Set(cpfSubAccountRows.map((r) => r.parentAssetId))
    const assetCategoryKey: Record<string, string> = {}
    for (const p of Object.values(holdingsData.positions) as Position[]) {
      if (parentIds.has(p.asset.id)) {
        assetCategoryKey[p.asset.id] = getReportCategory(p.asset)
      }
    }
    const grouped: Record<string, typeof cpfSubAccountRows> = {}
    for (const row of cpfSubAccountRows) {
      const key = assetCategoryKey[row.parentAssetId]
      if (!key) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(row)
    }
    return grouped
  }, [cpfSubAccountRows, holdingsData])

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
      socialSecurityMonthly: scenario.socialSecurityMonthly,
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

  // Transform holdings into category slices (or use manual assets if no holdings).
  // Income-stream categories (CPF, policy maturities) are surfaced in the
  // "Pays as income" read-only section of AssetsBreakdown rather than the
  // spendable toggles — so we keep them in the slice list and let the
  // display component split them. Filtering them out at the page level was
  // the cause of CPF + POLICY disappearing from Ruby's plan.
  const categorySlices = useMemo(() => {
    if (usingManualAssets) {
      const parsed = parseManualAssets(plan?.manualAssets)
      if (parsed) return manualAssetsToSlices(parsed)
    }
    if (!holdingsData) return []
    return transformToAllocationSlices(
      holdingsData,
      "category",
      ValueIn.PORTFOLIO,
    )
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
      isLoaded: true,
    },
    selectedPortfolioIds,
    monthlyInvestment,
    scenario,
    isAtBaseline: !scenarioIsDirty,
    rentalIncome,
    displayCurrency: displayCurrency ?? undefined,
    isSharedPlan,
    enabled: isSharedPlanResolved,
  })

  // For shared plans, demographics + retirement age MUST come from the
  // projection's planInputs echo (server resolves them from the plan
  // OWNER's settings via the M2M path). Falling through to
  // independenceSettings here renders the VIEWER's age + "Independence
  // (60)" marker on someone else's plan. Owned plans keep the existing
  // settings-driven path so pre-projection rendering still works.
  const planInputsAges = (
    adjustedProjection as unknown as
      | {
          planInputs?: {
            currentAge?: number
            retirementAge?: number
            lifeExpectancy?: number
          }
        }
      | null
      | undefined
  )?.planInputs
  const displayCurrentAge = isSharedPlan
    ? (planInputsAges?.currentAge ?? currentAge)
    : currentAge
  const displayRetirementAge = isSharedPlan
    ? (planInputsAges?.retirementAge ?? retirementAge)
    : retirementAge
  const displayLifeExpectancy = isSharedPlan
    ? (planInputsAges?.lifeExpectancy ?? lifeExpectancy)
    : lifeExpectancy

  // Display totals: prefer the server's authoritative numbers from the
  // projection echo so composite assets (CPF sub-accounts, future ILP/
  // generic) are reflected in the tile. Local categorySlices roll-up
  // omits composite assets because they aren't svc-position positions —
  // the projection (via PlanAllocationService) is the single source of
  // truth. Fall back to the local sum until the projection lands so the
  // tile renders something on first paint.
  const projectionTotals = adjustedProjection as unknown as
    | { totalAssets?: number; liquidAssets?: number }
    | null
    | undefined
  const displayTotalAssets =
    projectionTotals?.totalAssets != null
      ? projectionTotals.totalAssets
      : totalAssets
  const displayLiquidAssets =
    projectionTotals?.liquidAssets != null
      ? projectionTotals.liquidAssets
      : liquidAssets

  // Server-side asset breakdown (projection echo) drives the headline
  // category chart so composite policies (CPF / ILP / generic) appear
  // alongside Cash / ETF without bc-view re-deriving from svc-position
  // holdings (which don't see composite balances). Falls back to the
  // local roll-up until the projection lands so the chart renders on
  // first paint.
  const projectionAssetBreakdown = (
    adjustedProjection as unknown as
      | { assetBreakdown?: Array<{ category: string; value: number }> }
      | null
      | undefined
  )?.assetBreakdown
  const displayCategorySlices = useMemo(() => {
    if (projectionAssetBreakdown && projectionAssetBreakdown.length > 0) {
      return serverBreakdownToAllocationSlices(projectionAssetBreakdown)
    }
    return categorySlices
  }, [projectionAssetBreakdown, categorySlices])

  // FIRE data is ready when backend projection has completed with valid metrics
  const fireDataReady =
    !!plan &&
    !!adjustedProjection?.fiMetrics &&
    isAllocationValid &&
    !isCalculating

  // The FI Overview tab is only relevant to FIRE-strategy plans; pension /
  // hybrid plans lead with "My Plan". Hide it otherwise and bounce the user
  // back to My Plan if it was the active tab.
  const resolvedStrategyView =
    strategyView ?? defaultStrategyView(adjustedProjection?.effectiveStrategy)
  // FI Overview is relevant to FIRE and Self-funded (HYBRID) plans — and the
  // "All" lens — but not to pure Pension plans, which lead with My Plan.
  const showFiTab = resolvedStrategyView !== "PENSION"
  // Derive (don't mutate) the displayed tab so a hidden FI Overview never
  // leaves the view blank if the strategy flips while it was active.
  const effectiveTab: TabId =
    !showFiTab && activeTab === "fi" ? "details" : activeTab

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
  //
  // Intentionally NOT bridged: equityReturnRate / cashReturnRate /
  // housingReturnRate / equityAllocation / cashAllocation / housingAllocation.
  // Return rates live behind the Real Return slider (which adjusts cash+equity
  // proportionally) and allocations are not exposed in the ScenarioBar at all.
  // If a user edits those in the modal we drop them on the floor so we don't
  // mix two competing models.
  const handleApplyDetails = (overrides: {
    monthlyExpenses?: number
    pensionMonthly?: number
    socialSecurityMonthly?: number
    otherIncomeMonthly?: number
    inflationRate?: number
    excludedPortfolioIds?: string[]
    excludedRentalAssetIds?: string[]
  }): void => {
    setScenario({
      ...(overrides.monthlyExpenses != null && {
        monthlyExpenses: overrides.monthlyExpenses,
      }),
      ...(overrides.pensionMonthly != null && {
        pensionMonthly: overrides.pensionMonthly,
      }),
      ...(overrides.socialSecurityMonthly != null && {
        socialSecurityMonthly: overrides.socialSecurityMonthly,
      }),
      ...(overrides.otherIncomeMonthly != null && {
        otherIncomeMonthly: overrides.otherIncomeMonthly,
      }),
      ...(overrides.inflationRate != null && {
        inflation: overrides.inflationRate,
      }),
    })
    // Exclusion edits land in page state and get written on save — they
    // aren't part of the projection scenario, just plan-level filters.
    if (
      overrides.excludedPortfolioIds != null ||
      overrides.excludedRentalAssetIds != null
    ) {
      setPendingExclusions((prev) => ({
        excludedPortfolioIds:
          overrides.excludedPortfolioIds ?? prev?.excludedPortfolioIds,
        excludedRentalAssetIds:
          overrides.excludedRentalAssetIds ?? prev?.excludedRentalAssetIds,
      }))
    }
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
      // Allocations come from `plan` (not scenario) because they're not
      // slider-controlled — the Real Return slider adjusts per-asset return
      // rates via applyRealReturn, but the cash/equity/housing mix stays
      // as the user configured it in the plan settings. Exclusions take
      // pendingExclusions (set by the modal) when present, otherwise carry
      // forward whatever the plan already has.
      const updates = {
        name: plan.name,
        monthlyExpenses: scenario.monthlyExpenses,
        pensionMonthly: scenario.pensionMonthly,
        socialSecurityMonthly: scenario.socialSecurityMonthly,
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
        excludedPortfolioIds:
          pendingExclusions?.excludedPortfolioIds ??
          parseExcludedPortfolioIds(plan.excludedPortfolioIds),
        excludedRentalAssetIds:
          pendingExclusions?.excludedRentalAssetIds ??
          parseExcludedRentalAssetIds(plan.excludedRentalAssetIds),
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
          setPendingExclusions(null)
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
          setPendingExclusions(null)
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

          {/* Two-column layout: tab content left, Assumptions sidebar right on lg+.
              On mobile (flex-col) CSS order puts the sidebar (order-1) above the
              tabs (order-2); on desktop (lg:flex-row) order reverses so tabs are
              on the left and the sidebar is a sticky right column. */}
          <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
            {/* Assumptions sidebar — mobile: collapsible card above tabs (order-1),
                desktop: sticky right column (lg:order-2, ~w-80). */}
            {plan && (
              <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0 mb-3 lg:mb-0">
                <AssumptionsPanel
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
                  planInflation={plan.inflationRate}
                  planCashRate={plan.cashReturnRate}
                  planEquityRate={plan.equityReturnRate}
                  planCashAlloc={plan.cashAllocation}
                  pathToHorizon={adjustedProjection?.pathToHorizon}
                />
              </div>
            )}

            {/* Main content — mobile: below sidebar (order-2), desktop: left column (lg:order-1). */}
            <div className="order-2 lg:order-1 lg:flex-1 min-w-0">
              {/* Tab Navigation */}
              <PlanTabNavigation
                activeTab={effectiveTab}
                onTabChange={setActiveTab}
                hasAssets={hasAssets}
                showFiTab={showFiTab}
              />

              {/* Tab Content */}
              {effectiveTab === "fi" && (
                <PlanFiOverviewTab
                  plan={plan}
                  projection={adjustedProjection}
                  scenario={scenario}
                  assets={{
                    liquidAssets,
                    nonSpendableAssets,
                    totalAssets,
                    hasAssets,
                    isLoaded: true,
                  }}
                  monthlyInvestment={monthlyInvestment}
                  rentalIncome={rentalIncome}
                  displayCurrency={displayCurrency ?? undefined}
                  effectiveCurrency={effectiveCurrency}
                  currentAge={displayCurrentAge}
                  isCalculating={isCalculating}
                  hideValues={hideValues}
                />
              )}

              {effectiveTab === "details" && (
                <DetailsTabContent
                  plan={plan}
                  scenario={scenario}
                  projection={adjustedProjection}
                  rentalIncome={rentalIncome}
                  effectiveCurrency={effectiveCurrency}
                  planCurrency={planCurrency}
                  onEditDetails={() => setShowEditDetailsModal(true)}
                  liquidAssets={displayLiquidAssets}
                  blendedReturnRate={blendedReturnRate}
                  currentAge={displayCurrentAge}
                  retirementAge={displayRetirementAge}
                  effectiveFxRate={effectiveFxRate}
                  excludedPensionFV={excludedPensionFV}
                  includedPensionFvDifferential={includedPensionFvDifferential}
                />
              )}

              {effectiveTab === "breakdown" &&
                (isSharedPlan && displayCategorySlices.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
                    <p className="font-medium mb-1">
                      <i className="fas fa-share-alt mr-2"></i>
                      Owner-scoped projection
                    </p>
                    <p>
                      Per-category asset breakdown for this shared plan needs
                      the plan owner to also share their portfolios with you.
                      The projection uses the owner&apos;s holdings via a
                      server-side fetch.
                    </p>
                  </div>
                ) : (
                  <AssetsBreakdown
                    categorySlices={displayCategorySlices}
                    spendableCategories={spendableCategories}
                    onToggleCategory={toggleCategory}
                    pensionProjections={pensionProjections}
                    totalAssets={displayTotalAssets}
                    liquidAssets={displayLiquidAssets}
                    effectiveCurrency={effectiveCurrency}
                    effectiveFxRate={effectiveFxRate}
                    isCalculating={isCalculating}
                    holdingsLoaded={!!holdingsData}
                    usingManualAssets={usingManualAssets}
                    isRefreshingHoldings={isRefreshingHoldings}
                    onRefreshHoldings={() => refreshHoldings()}
                    cpfSubAccountsByCategoryKey={cpfSubAccountsByCategoryKey}
                  />
                ))}

              {effectiveTab === "assets" && (
                <AssetsTabContent
                  projection={adjustedProjection}
                  effectivePlanValues={effectivePlanValues}
                  blendedReturnRate={blendedReturnRate}
                  currentAge={displayCurrentAge}
                  retirementAge={displayRetirementAge}
                  effectiveCurrency={effectiveCurrency}
                  fireDataReady={fireDataReady}
                  view={
                    strategyView ??
                    defaultStrategyView(adjustedProjection?.effectiveStrategy)
                  }
                />
              )}

              {effectiveTab === "timeline" && (
                <TimelineTabContent
                  projection={adjustedProjection}
                  baselineProjection={baselineProjection}
                  retirementAge={displayRetirementAge}
                  lifeExpectancy={displayLifeExpectancy}
                  hideValues={hideValues}
                  isCalculating={isCalculating}
                  effectiveCurrency={effectiveCurrency}
                />
              )}

              {/* Simulation Tab - Monte Carlo Analysis */}
              {effectiveTab === "simulation" && (
                <MonteCarloTab
                  plan={plan}
                  assets={{
                    liquidAssets,
                    nonSpendableAssets,
                    totalAssets,
                    hasAssets,
                    isLoaded: true,
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
