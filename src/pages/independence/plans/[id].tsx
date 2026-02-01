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
  ReferenceArea,
  Legend,
} from "recharts"
import InfoTooltip from "@components/ui/Tooltip"
import CollapsibleSection from "@components/ui/CollapsibleSection"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { PlanResponse, QuickScenariosResponse } from "types/independence"
import {
  Portfolio,
  HoldingContract,
  FxResponse,
  Position,
} from "types/beancounter"
import {
  transformToAllocationSlices,
  AllocationSlice,
} from "@lib/allocation/aggregateHoldings"
import { ManualAssetCategory } from "types/independence"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  WhatIfAdjustments,
  ScenarioOverrides,
  TabId,
  TABS,
  DEFAULT_NON_SPENDABLE_CATEGORIES,
  DEFAULT_WHAT_IF_ADJUSTMENTS,
  hasScenarioChanges,
  useUnifiedProjection,
  RentalIncomeData,
  WhatIfModal,
  ScenarioImpact,
  SaveScenarioDialog,
  EditPlanDetailsModal,
  IncomeBreakdownTable,
  MonteCarloTab,
  FiMetrics,
  FiSummaryBar,
  PlanViewHeader,
  PlanTabNavigation,
  AnalysisToolbar,
} from "@components/features/independence"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { usePrivacyMode } from "@hooks/usePrivacyMode"

const HIDDEN_VALUE = "****"

// Manual asset category display configuration
const MANUAL_ASSET_CONFIG: Record<
  ManualAssetCategory,
  { label: string; color: string; isSpendable: boolean }
> = {
  CASH: { label: "Cash", color: "#6B7280", isSpendable: true },
  EQUITY: { label: "Equity", color: "#3B82F6", isSpendable: true },
  ETF: { label: "ETF", color: "#10B981", isSpendable: true },
  MUTUAL_FUND: { label: "Mutual Fund", color: "#8B5CF6", isSpendable: true },
  RE: { label: "Property", color: "#F59E0B", isSpendable: false },
}

/**
 * Convert plan's manual asset values to AllocationSlice format.
 * Used when user has no portfolio holdings but has entered manual asset values.
 */
function manualAssetsToSlices(
  manualAssets: Record<string, number> | undefined,
): AllocationSlice[] {
  if (!manualAssets) return []

  const slices: AllocationSlice[] = []
  const total = Object.values(manualAssets).reduce((sum, v) => sum + v, 0)

  for (const [category, value] of Object.entries(manualAssets)) {
    if (value <= 0) continue
    const config = MANUAL_ASSET_CONFIG[category as ManualAssetCategory]
    if (!config) continue

    slices.push({
      key: config.label,
      label: config.label,
      value,
      percentage: total > 0 ? (value / total) * 100 : 0,
      color: config.color,
      gainOnDay: 0,
      irr: 0,
    })
  }

  return slices
}

/**
 * Parse manualAssets from JSON string if needed.
 * Backend stores as JSON string, but we need it as an object.
 */
function parseManualAssets(
  manualAssets: Record<string, number> | string | undefined | null,
): Record<string, number> | undefined {
  if (!manualAssets) return undefined
  // If it's already an object, return it
  if (typeof manualAssets === "object") {
    return manualAssets
  }
  // Otherwise parse from JSON string
  try {
    return JSON.parse(manualAssets)
  } catch {
    return undefined
  }
}

/**
 * Check if plan has manual assets with non-zero values.
 */
function hasManualAssets(
  manualAssets: Record<string, number> | string | undefined | null,
): boolean {
  const parsed = parseManualAssets(manualAssets)
  if (!parsed) return false
  return Object.values(parsed).some((v) => v > 0)
}

interface PortfoliosResponse {
  data: Portfolio[]
}

// Pension/Policy FV projection for Assets tab
interface PensionProjection {
  assetId: string
  assetName: string
  currentValue: number
  projectedValue: number
  payoutAge: number
  currency: string
  category: string // Report category for toggle matching
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

  // Track which collapsible sections are open (session memory)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  const toggleSection = (key: string): void =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

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
  // Version counter to force modal re-initialization after save
  const [planVersion, setPlanVersion] = useState(0)

  // Timeline view mode - "traditional" shows work-to-retire path, "fire" shows FIRE path
  const [timelineViewMode, setTimelineViewMode] = useState<
    "traditional" | "fire"
  >("traditional")

  // Pension/Policy FV projections for Assets tab
  const [pensionProjections, setPensionProjections] = useState<
    PensionProjection[]
  >([])

  const { data: planData, error: planError } = useSwr<PlanResponse>(
    id ? `/api/independence/plans/${id}` : null,
    id ? simpleFetcher(`/api/independence/plans/${id}`) : null,
    {
      // Always fetch fresh data when viewing a plan - avoids stale cache after edits
      revalidateOnMount: true,
      revalidateIfStale: true,
      dedupingInterval: 0,
    },
  )

  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Fetch aggregated holdings to get category breakdown
  // Disable auto-revalidation - only refresh on manual action for performance
  // Use dedupingInterval for caching across page refreshes
  const {
    data: holdingsResponse,
    isLoading: holdingsLoading,
    mutate: refreshHoldings,
    isValidating: isRefreshingHoldings,
  } = useSwr<{ data: HoldingContract }>(
    "/api/holdings/aggregated?asAt=today",
    simpleFetcher("/api/holdings/aggregated?asAt=today"),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 60 seconds
    },
  )
  // Only use holdings data when it has finished loading
  const holdingsData = holdingsLoading ? undefined : holdingsResponse?.data

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
  // For plan values that need frontend FX conversion
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

  // Get rental income by currency (backend handles FX conversion)
  const monthlyNetByCurrency = useMemo(() => {
    if (!assetConfigs || assetConfigs.length === 0) return {}
    return getNetRentalByCurrency()
  }, [assetConfigs, getNetRentalByCurrency])

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

  // Effective plan values: What-If (scenarioOverrides) takes precedence over plan values
  // These are the values used for ALL calculations - What-If always overrides plan
  const effectivePlanValues = useMemo(() => {
    if (!plan) return null
    return {
      monthlyExpenses:
        scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses,
      cashReturnRate: scenarioOverrides.cashReturnRate ?? plan.cashReturnRate,
      equityReturnRate:
        scenarioOverrides.equityReturnRate ?? plan.equityReturnRate,
      housingReturnRate:
        scenarioOverrides.housingReturnRate ?? plan.housingReturnRate,
      inflationRate: scenarioOverrides.inflationRate ?? plan.inflationRate,
      pensionMonthly: scenarioOverrides.pensionMonthly ?? plan.pensionMonthly,
      socialSecurityMonthly:
        scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly,
      otherIncomeMonthly:
        scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly,
      targetBalance: scenarioOverrides.targetBalance ?? plan.targetBalance,
      cashAllocation: plan.cashAllocation,
      equityAllocation: plan.equityAllocation,
      housingAllocation: plan.housingAllocation,
    }
  }, [plan, scenarioOverrides])

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
  const categorySlices = useMemo((): AllocationSlice[] => {
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
  }, [holdingsData, usingManualAssets, plan?.manualAssets])

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
        (cat) => !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(cat),
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
    // Before initialization, use default: all categories except non-spendable ones
    return categorySlices
      .map((s) => s.key)
      .filter((cat) => !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(cat))
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

  // Calculate FV adjustment for pension/policy assets based on category selection
  // When a pension/policy category is excluded, we need to subtract its FV (not just current value)
  // from the backend's liquidAssetsAtRetirement
  const excludedPensionFV = useMemo(() => {
    return pensionProjections
      .filter((p) => !effectiveSpendableCategories.includes(p.category))
      .reduce((sum, p) => sum + p.projectedValue, 0)
  }, [pensionProjections, effectiveSpendableCategories])

  // Calculate the FV differential for included pension/policy assets
  // This is (FV - currentValue) which represents growth to be added
  const includedPensionFvDifferential = useMemo(() => {
    return pensionProjections
      .filter((p) => effectiveSpendableCategories.includes(p.category))
      .reduce((sum, p) => sum + (p.projectedValue - p.currentValue), 0)
  }, [pensionProjections, effectiveSpendableCategories])

  // Default expected return rate for assets without a configured rate (3%)
  const DEFAULT_EXPECTED_RETURN = 0.03

  // Calculate weighted blended return rate from per-asset expected return rates
  // Uses effectivePlanValues which applies What-If overrides
  const blendedReturnRate = useMemo(() => {
    // When using manual assets, calculate weighted rate based on effective rates
    if (usingManualAssets && effectivePlanValues) {
      const assets = parseManualAssets(plan?.manualAssets)
      if (assets) {
        // Map category to return rate (using What-If adjusted rates)
        const rateMap: Record<string, number> = {
          CASH: effectivePlanValues.cashReturnRate,
          EQUITY: effectivePlanValues.equityReturnRate,
          ETF: effectivePlanValues.equityReturnRate,
          MUTUAL_FUND: effectivePlanValues.equityReturnRate,
          // RE excluded from blended rate (non-spendable)
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
      // Fall back to allocation-based blended rate (using What-If adjusted rates)
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
      if (DEFAULT_NON_SPENDABLE_CATEGORIES.includes(reportCategory)) continue

      const rate = position.asset.expectedReturnRate ?? DEFAULT_EXPECTED_RETURN
      totalValue += marketValue
      weightedSum += marketValue * rate
    }

    return totalValue > 0 ? weightedSum / totalValue : DEFAULT_EXPECTED_RETURN
  }, [holdingsData, plan?.manualAssets, effectivePlanValues, usingManualAssets])

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

  // Identify pension/policy assets with lump sum settings for FV projection
  const lumpSumAssets = useMemo(() => {
    if (!assetConfigs || !holdingsData?.positions) return []
    const positions = Object.values(holdingsData.positions) as Position[]
    return assetConfigs
      .filter((config) => config.isPension && config.lumpSum)
      .map((config) => {
        // Find matching position to get current market value and category
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
      .filter((item) => item.currentValue > 0) // Only include assets with value
  }, [assetConfigs, holdingsData])

  // Fetch FV projections for lump sum pension/policy assets
  useEffect(() => {
    const fetchPensionProjections = async (): Promise<void> => {
      if (!lumpSumAssets.length || currentAge === undefined) {
        setPensionProjections([])
        return
      }

      const projections: PensionProjection[] = []

      for (const asset of lumpSumAssets) {
        const { config, assetName, currentValue, category } = asset

        // Skip if missing required fields
        if (!config.payoutAge || !config.expectedReturnRate) {
          continue
        }

        // If payout age is already reached, projected = current
        if (currentAge >= config.payoutAge) {
          projections.push({
            assetId: config.assetId,
            assetName,
            currentValue,
            projectedValue: currentValue,
            payoutAge: config.payoutAge,
            currency: config.rentalCurrency || planCurrency,
            category,
          })
          continue
        }

        try {
          const response = await fetch("/api/projection/lump-sum", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              monthlyContribution: config.monthlyContribution || 0,
              expectedReturnRate: config.expectedReturnRate,
              currentAge: currentAge,
              payoutAge: config.payoutAge,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            // FV = current value grown + contribution FV
            const yearsToMaturity = config.payoutAge - currentAge
            const grownCurrentValue =
              currentValue *
              Math.pow(1 + config.expectedReturnRate, yearsToMaturity)
            const contributionFV = data.data?.projectedPayout || 0
            const totalProjected = grownCurrentValue + contributionFV

            projections.push({
              assetId: config.assetId,
              assetName,
              currentValue,
              projectedValue: totalProjected,
              payoutAge: config.payoutAge,
              currency: config.rentalCurrency || planCurrency,
              category,
            })
          }
        } catch (err) {
          console.error(
            `Failed to fetch projection for ${config.assetId}:`,
            err,
          )
        }
      }

      setPensionProjections(projections)
    }

    fetchPensionProjections()
  }, [lumpSumAssets, currentAge, planCurrency])

  // Calculate pre-retirement contributions (for passing to backend)
  // Uses scenarioOverrides.workingIncomeMonthly if user adjusted salary in What-If
  // Net income = salary + bonus - taxes (matches ContributionsStep calculation)
  const effectiveWorkingIncome =
    scenarioOverrides.workingIncomeMonthly ?? plan?.workingIncomeMonthly ?? 0
  const effectiveNetIncome =
    effectiveWorkingIncome +
    (plan?.bonusMonthly ?? 0) -
    (plan?.taxesMonthly ?? 0)
  const monthlySurplus =
    effectiveNetIncome - (plan?.workingExpensesMonthly || 0)
  const monthlyInvestment =
    monthlySurplus > 0
      ? monthlySurplus * (plan?.investmentAllocationPercent || 0.8)
      : 0

  // Combine What-If adjustments with selected quick scenarios
  const combinedAdjustments = useMemo((): WhatIfAdjustments => {
    let result = whatIfAdjustments

    if (selectedScenarioIds.length > 0) {
      // Get the selected scenarios
      const selected = quickScenarios.filter((s) =>
        selectedScenarioIds.includes(s.id),
      )

      // Apply each selected scenario using reduce
      result = selected.reduce(
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
    }

    // Ensure retirement age offset doesn't push effective age below current age
    if (currentAge !== undefined) {
      const minOffset = currentAge - retirementAge
      if (result.retirementAgeOffset < minOffset) {
        result = { ...result, retirementAgeOffset: minOffset }
      }
    }

    return result
  }, [
    whatIfAdjustments,
    selectedScenarioIds,
    quickScenarios,
    currentAge,
    retirementAge,
  ])

  // Toggle a quick scenario selection
  const toggleScenario = (scenarioId: string): void => {
    setSelectedScenarioIds((prev) =>
      prev.includes(scenarioId)
        ? prev.filter((id) => id !== scenarioId)
        : [...prev, scenarioId],
    )
  }

  // Use unified projection hook
  // Pass pre-calculated assets to avoid backend refetch from svc-position
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
    currentAge,
    retirementAge,
    lifeExpectancy,
    monthlyInvestment,
    whatIfAdjustments: combinedAdjustments,
    scenarioOverrides,
    rentalIncome,
    displayCurrency: displayCurrency ?? undefined,
  })

  // Plan inputs from backend (already FX converted when displayCurrency differs)
  const planInputs = adjustedProjection?.planInputs

  // FIRE data is ready when backend projection has completed with valid metrics
  // This ensures we never show partial/inconsistent data to the user
  const fireDataReady =
    !!plan &&
    !!adjustedProjection?.fiMetrics &&
    isAllocationValid &&
    !isCalculating

  // Combine accumulation (working years) and drawdown (retirement years) for chart
  const fullJourneyData = useMemo(() => {
    if (!adjustedProjection) return []

    // Convert accumulation projections to chart format
    // Use separate data keys for different line colors
    const accumulationData = (
      adjustedProjection.accumulationProjections || []
    ).map((year) => ({
      age: year.age,
      endingBalance: year.endingBalance,
      accumulationBalance: year.endingBalance, // Blue line (working years)
      retirementBalance: null as number | null,
      totalWealth: year.totalWealth,
      contribution: year.contribution,
      investmentGrowth: year.investmentGrowth,
      phase: "accumulation" as const,
    }))

    // Convert retirement projections to chart format
    const retirementData = adjustedProjection.yearlyProjections.map(
      (year, index) => ({
        age: year.age,
        endingBalance: year.endingBalance,
        accumulationBalance:
          index === 0 ? year.endingBalance : (null as number | null), // Connect to accumulation line
        retirementBalance: year.endingBalance, // Purple line (independence years)
        totalWealth: year.totalWealth,
        withdrawals: year.withdrawals,
        investment: year.investment,
        phase: "retirement" as const,
      }),
    )

    return [...accumulationData, ...retirementData]
  }, [adjustedProjection])

  // FI achievement age from backend calculation
  const fiAchievementAge = adjustedProjection?.fiAchievementAge ?? null

  // Merge backend FIRE path projections into full journey data for chart display
  const chartDataWithFirePath = useMemo(() => {
    const firePathProjections = adjustedProjection?.firePathProjections
    if (!firePathProjections || firePathProjections.length === 0)
      return fullJourneyData

    // Create a map of age -> fireBalance from backend projections
    const fireBalanceMap = new Map(
      firePathProjections.map((d) => [d.age, d.endingBalance]),
    )

    // Add fireBalance to each data point
    return fullJourneyData.map((point) => ({
      ...point,
      fireBalance:
        point.age != null ? (fireBalanceMap.get(point.age) ?? null) : null,
    }))
  }, [fullJourneyData, adjustedProjection?.firePathProjections])

  // Determine if what-if changes are active (sliders or scenario overrides)
  const hasActiveWhatIf =
    hasScenarioChanges(combinedAdjustments) ||
    Object.keys(scenarioOverrides).length > 0

  // Merge baseline projection data into chart points for comparison line
  const chartDataWithBaseline = useMemo(() => {
    if (!baselineProjection || !hasActiveWhatIf) return chartDataWithFirePath

    const map = new Map<number, number>()
    for (const y of baselineProjection.accumulationProjections || []) {
      if (y.age != null) map.set(y.age, y.endingBalance)
    }
    for (const y of baselineProjection.yearlyProjections) {
      if (y.age != null) map.set(y.age, y.endingBalance)
    }

    return chartDataWithFirePath.map((point) => ({
      ...point,
      baselineBalance: point.age != null ? (map.get(point.age) ?? null) : null,
    }))
  }, [chartDataWithFirePath, baselineProjection, hasActiveWhatIf])

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

  // Apply edited values to local scenario state (not saved to backend yet)
  const handleApplyDetails = (overrides: ScenarioOverrides): void => {
    setScenarioOverrides(overrides)
    setShowEditDetailsModal(false)
  }

  // Save scenario to backend (update existing or create new plan)
  const handleSaveScenario = async (
    mode: "update" | "new",
    newPlanName?: string,
  ): Promise<void> => {
    if (!plan) return
    setIsSaving(true)
    try {
      const updates = {
        monthlyExpenses:
          scenarioOverrides.monthlyExpenses ?? plan.monthlyExpenses,
        pensionMonthly: scenarioOverrides.pensionMonthly ?? plan.pensionMonthly,
        socialSecurityMonthly:
          scenarioOverrides.socialSecurityMonthly ?? plan.socialSecurityMonthly,
        otherIncomeMonthly:
          scenarioOverrides.otherIncomeMonthly ?? plan.otherIncomeMonthly,
        inflationRate: scenarioOverrides.inflationRate ?? plan.inflationRate,
        targetBalance: scenarioOverrides.targetBalance ?? plan.targetBalance,
        equityReturnRate:
          scenarioOverrides.equityReturnRate ?? plan.equityReturnRate,
        cashReturnRate: scenarioOverrides.cashReturnRate ?? plan.cashReturnRate,
        housingReturnRate:
          scenarioOverrides.housingReturnRate ?? plan.housingReturnRate,
        equityAllocation:
          scenarioOverrides.equityAllocation ?? plan.equityAllocation,
        cashAllocation: scenarioOverrides.cashAllocation ?? plan.cashAllocation,
        housingAllocation:
          scenarioOverrides.housingAllocation ?? plan.housingAllocation,
      }

      if (mode === "update") {
        // PATCH existing plan
        const response = await fetch(`/api/independence/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (response.ok) {
          // Use response data to update SWR cache directly (more reliable than revalidation)
          const updatedPlan = await response.json()
          await mutate(`/api/independence/plans/${id}`, updatedPlan, false)
          setScenarioOverrides({})
          setShowSaveDialog(false)
          // Increment version to force modal re-initialization on next open
          setPlanVersion((v) => v + 1)
        }
      } else {
        // POST new plan
        const newPlan = {
          name: newPlanName || `${plan.name} (Scenario)`,
          yearOfBirth: plan.yearOfBirth,
          lifeExpectancy: plan.lifeExpectancy,
          planningHorizonYears: plan.planningHorizonYears,
          expensesCurrency: plan.expensesCurrency,
          workingIncomeMonthly: plan.workingIncomeMonthly,
          workingExpensesMonthly: plan.workingExpensesMonthly,
          taxesMonthly: plan.taxesMonthly,
          bonusMonthly: plan.bonusMonthly,
          investmentAllocationPercent: plan.investmentAllocationPercent,
          ...updates,
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

          {/* Loading Overlay - shown during initial projection calculation */}
          {isCalculating && !adjustedProjection && (
            <div className="fixed inset-0 bg-white/80 z-40 flex items-center justify-center">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-4xl text-orange-500 mb-4"></i>
                <p className="text-gray-600 font-medium">
                  Calculating projections...
                </p>
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

          {/* FIRE Summary Bar - Only show when ALL FIRE data is ready */}
          {/* Uses backend FI metrics but CURRENT asset values from local calculation */}
          {/* This ensures consistency with the Assets tab display */}
          {fireDataReady && adjustedProjection ? (
            <FiSummaryBar
              fiNumber={adjustedProjection.fiMetrics!.fiNumber}
              liquidAssets={
                adjustedProjection.preRetirementAccumulation
                  ?.currentLiquidAssets ?? liquidAssets * effectiveFxRate
              }
              illiquidAssets={
                adjustedProjection.preRetirementAccumulation
                  ?.currentNonSpendableAssets ??
                nonSpendableAssets * effectiveFxRate
              }
              currency={effectiveCurrency}
              isCoastFire={adjustedProjection.fiMetrics!.isCoastFire}
              yearsToRetirement={
                adjustedProjection.preRetirementAccumulation?.yearsToRetirement
              }
              backendFiProgress={adjustedProjection.fiMetrics!.fiProgress}
              expenseAdjustmentPercent={
                adjustedProjection.expenseAdjustmentPercent
              }
              warnings={adjustedProjection.warnings}
            />
          ) : (
            (isCalculating || (plan && !adjustedProjection)) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Calculating FI metrics...</span>
                </div>
              </div>
            )
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

          {/* Global What-If toolbar - available on all tabs */}
          <AnalysisToolbar
            quickScenarios={quickScenarios}
            selectedScenarioIds={selectedScenarioIds}
            hasUnsavedChanges={
              hasScenarioChanges(whatIfAdjustments) ||
              Object.keys(scenarioOverrides).length > 0 ||
              selectedScenarioIds.length > 0
            }
            onWhatIfClick={() => setShowWhatIfModal(true)}
            onScenarioToggle={toggleScenario}
            onSave={() => setShowSaveDialog(true)}
            onReset={() => {
              resetWhatIf()
              resetScenarioOverrides()
              setSelectedScenarioIds([])
            }}
          />

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

              // Display values - always use backend planInputs (already FX-converted).
              // Never do frontend FX conversion here — avoids rate-direction mismatches.
              // During the brief projection recalculation window after a currency change,
              // values stay in the projection's current currency until the backend responds.
              const detailsCurrency =
                adjustedProjection?.currency || planCurrency
              const displayExpenses =
                planInputs?.monthlyExpenses ?? effectiveExpenses
              const displayPension =
                planInputs?.pensionMonthly ?? effectivePension
              const displaySocialSecurity =
                planInputs?.socialSecurityMonthly ?? effectiveSocialSecurity
              const displayOtherIncome =
                planInputs?.otherIncomeMonthly ?? effectiveOtherIncome
              const displayRentalIncome =
                planInputs?.rentalIncomeMonthly ??
                rentalIncome?.totalMonthlyInPlanCurrency ??
                0
              const displayTarget =
                planInputs?.targetBalance ?? effectiveTarget ?? 0
              const displayNetMonthlyNeed = Math.max(
                0,
                displayExpenses -
                  displayPension -
                  displaySocialSecurity -
                  displayOtherIncome -
                  displayRentalIncome,
              )

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
                            : `${detailsCurrency}${Math.round(displayExpenses).toLocaleString()}`}
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
                            : `${detailsCurrency}${Math.round(displayPension).toLocaleString()}`}
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
                            : `${detailsCurrency}${Math.round(displaySocialSecurity).toLocaleString()}`}
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
                            : `${detailsCurrency}${Math.round(displayOtherIncome).toLocaleString()}`}
                        </span>
                      </div>
                      {displayRentalIncome > 0 && (
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
                              : `${detailsCurrency}${Math.round(displayRentalIncome).toLocaleString()}`}
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
                            : `${detailsCurrency}${Math.round(displayNetMonthlyNeed).toLocaleString()}`}
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
                              : `${detailsCurrency}${Math.round(displayTarget).toLocaleString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sustainable Spending */}
                  {adjustedProjection?.sustainableMonthlyExpense != null && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Sustainable Spending
                      </h2>
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                            Monthly Expense Budget
                          </span>
                          <div
                            className={`text-2xl font-bold ${hideValues ? "text-gray-400" : "text-green-600"}`}
                          >
                            {hideValues
                              ? HIDDEN_VALUE
                              : `${detailsCurrency}${Math.round(adjustedProjection.sustainableMonthlyExpense).toLocaleString()}`}
                          </div>
                        </div>
                        {adjustedProjection.sustainableTargetBalance !=
                          null && (
                          <div className="text-sm text-gray-500">
                            Targeting{" "}
                            {hideValues
                              ? HIDDEN_VALUE
                              : `${detailsCurrency}${Math.round(adjustedProjection.sustainableTargetBalance).toLocaleString()}`}{" "}
                            ending balance
                          </div>
                        )}
                        <hr />
                        {adjustedProjection.expenseAdjustment != null &&
                          adjustedProjection.expenseAdjustmentPercent !=
                            null && (
                            <div
                              className={`text-sm font-medium ${
                                adjustedProjection.expenseAdjustment >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {hideValues ? (
                                <span className="text-gray-400">
                                  {HIDDEN_VALUE}
                                </span>
                              ) : adjustedProjection.expenseAdjustment >= 0 ? (
                                <>
                                  <i className="fas fa-arrow-up mr-1"></i>
                                  Room to increase +{detailsCurrency}
                                  {Math.round(
                                    adjustedProjection.expenseAdjustment,
                                  ).toLocaleString()}
                                  /mo (+
                                  {adjustedProjection.expenseAdjustmentPercent.toFixed(
                                    1,
                                  )}
                                  %)
                                </>
                              ) : (
                                <>
                                  <i className="fas fa-arrow-down mr-1"></i>
                                  Need to reduce {detailsCurrency}
                                  {Math.round(
                                    adjustedProjection.expenseAdjustment,
                                  ).toLocaleString()}
                                  /mo (
                                  {adjustedProjection.expenseAdjustmentPercent.toFixed(
                                    1,
                                  )}
                                  %)
                                </>
                              )}
                            </div>
                          )}
                        {/* With-liquidation figure */}
                        {adjustedProjection.sustainableWithLiquidation !=
                          null &&
                          adjustedProjection.sustainableWithLiquidation !==
                            adjustedProjection.sustainableMonthlyExpense && (
                            <>
                              <hr />
                              <div>
                                <span className="text-xs text-gray-500 uppercase tracking-wide">
                                  Including Asset Disposal
                                </span>
                                <div
                                  className={`text-xl font-bold ${hideValues ? "text-gray-400" : "text-blue-600"}`}
                                >
                                  {hideValues
                                    ? HIDDEN_VALUE
                                    : `${detailsCurrency}${Math.round(adjustedProjection.sustainableWithLiquidation).toLocaleString()}`}
                                  <span className="text-sm font-normal text-gray-500">
                                    /mo
                                  </span>
                                </div>
                                {adjustedProjection.liquidationAge != null && (
                                  <div className="text-sm text-gray-500">
                                    Property disposal from age{" "}
                                    {adjustedProjection.liquidationAge}
                                  </div>
                                )}
                                {adjustedProjection.adjustmentWithLiquidation !=
                                  null &&
                                  adjustedProjection.adjustmentPercentWithLiquidation !=
                                    null && (
                                    <div
                                      className={`text-sm font-medium ${
                                        adjustedProjection.adjustmentWithLiquidation >=
                                        0
                                          ? "text-blue-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {!hideValues &&
                                        (adjustedProjection.adjustmentWithLiquidation >=
                                        0 ? (
                                          <>
                                            +{detailsCurrency}
                                            {Math.round(
                                              adjustedProjection.adjustmentWithLiquidation,
                                            ).toLocaleString()}
                                            /mo (+
                                            {adjustedProjection.adjustmentPercentWithLiquidation.toFixed(
                                              1,
                                            )}
                                            %)
                                          </>
                                        ) : (
                                          <>
                                            {detailsCurrency}
                                            {Math.round(
                                              adjustedProjection.adjustmentWithLiquidation,
                                            ).toLocaleString()}
                                            /mo (
                                            {adjustedProjection.adjustmentPercentWithLiquidation.toFixed(
                                              1,
                                            )}
                                            %)
                                          </>
                                        ))}
                                    </div>
                                  )}
                              </div>
                            </>
                          )}
                      </div>
                    </div>
                  )}
                  {/* Income Reducing Your FI Target */}
                  {adjustedProjection?.fiMetrics &&
                    adjustedProjection.fiMetrics.totalMonthlyIncome > 0 && (
                      <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          <i className="fas fa-coins text-green-500 mr-2"></i>
                          Income Reducing Your FI Target
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Your FI Number is based on <strong>net</strong>{" "}
                          expenses - what you need from investments after
                          accounting for other income sources.
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
                                    adjustedProjection.fiMetrics
                                      .totalMonthlyIncome,
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
                                    adjustedProjection.fiMetrics
                                      .netMonthlyExpenses,
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
                </div>
              )
            })()}

          {/* Assets Tab */}
          {activeTab === "assets" && (
            <div className="space-y-6">
              {/* FI Metrics - moved from FIRE tab */}
              {fireDataReady && adjustedProjection?.fiMetrics && (
                <FiMetrics
                  monthlyExpenses={
                    adjustedProjection.fiMetrics.netMonthlyExpenses
                  }
                  liquidAssets={adjustedProjection.liquidAssets}
                  currency={effectiveCurrency}
                  workingIncomeMonthly={
                    adjustedProjection.planInputs?.workingIncomeMonthly ?? 0
                  }
                  monthlyInvestment={
                    adjustedProjection.planInputs?.monthlyContribution ?? 0
                  }
                  expectedReturnRate={blendedReturnRate}
                  currentAge={currentAge}
                  retirementAge={retirementAge}
                  backendFiNumber={adjustedProjection.fiMetrics.fiNumber}
                  backendFiProgress={adjustedProjection.fiMetrics.fiProgress}
                  backendNetMonthlyExpenses={
                    adjustedProjection.fiMetrics.netMonthlyExpenses
                  }
                  backendCoastFiNumber={
                    adjustedProjection.fiMetrics.coastFiNumber
                  }
                  backendCoastFiProgress={
                    adjustedProjection.fiMetrics.coastFiProgress
                  }
                  backendIsCoastFire={adjustedProjection.fiMetrics.isCoastFire}
                  backendRealYearsToFi={
                    adjustedProjection.fiMetrics.realYearsToFi
                  }
                  backendRealReturnBelowSwr={
                    adjustedProjection.fiMetrics.realReturnBelowSwr
                  }
                  inflationRate={effectivePlanValues?.inflationRate ?? 0.025}
                  equityReturnRate={
                    effectivePlanValues?.equityReturnRate ?? 0.08
                  }
                  cashReturnRate={effectivePlanValues?.cashReturnRate ?? 0.03}
                  equityAllocation={
                    effectivePlanValues?.equityAllocation ?? 0.8
                  }
                  cashAllocation={effectivePlanValues?.cashAllocation ?? 0.2}
                />
              )}

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("retire.assets.title")}
                  </h2>
                  {!usingManualAssets && (
                    <button
                      onClick={() => refreshHoldings()}
                      disabled={isRefreshingHoldings}
                      className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      title="Refresh holdings from portfolio"
                    >
                      <i
                        className={`fas fa-sync-alt mr-1 ${isRefreshingHoldings ? "fa-spin" : ""}`}
                      ></i>
                      {isRefreshingHoldings ? "Refreshing..." : "Refresh"}
                    </button>
                  )}
                </div>

                {!holdingsData && !usingManualAssets ? (
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
                    {usingManualAssets ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                        <p className="text-sm text-blue-800">
                          <i className="fas fa-info-circle mr-2"></i>
                          Using manually entered asset values from plan
                          settings.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {t("retire.assets.selectCategories")}
                      </p>
                    )}
                    <div className="space-y-2">
                      {/* Show liquid/spendable asset categories */}
                      {categorySlices
                        .filter(
                          (slice) =>
                            !DEFAULT_NON_SPENDABLE_CATEGORIES.includes(
                              slice.key,
                            ),
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
                                    : `${effectiveCurrency}${Math.round(slice.value * effectiveFxRate).toLocaleString()}`}
                                </span>
                              </label>
                            </div>
                          )
                        })}

                      {/* Show non-spendable (Property) separately */}
                      {categorySlices
                        .filter((slice) =>
                          DEFAULT_NON_SPENDABLE_CATEGORIES.includes(slice.key),
                        )
                        .map((slice) => (
                          <div
                            key={slice.key}
                            className="p-3 rounded-lg border border-amber-200 bg-amber-50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: slice.color }}
                                />
                                <span className="text-gray-700">
                                  {slice.label}
                                </span>
                                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                                  Non-spendable
                                </span>
                              </div>
                              <span className="font-medium text-gray-500">
                                {hideValues
                                  ? HIDDEN_VALUE
                                  : `${effectiveCurrency}${Math.round(slice.value * effectiveFxRate).toLocaleString()}`}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Pension/Policy FV Projections */}
                    {pensionProjections.length > 0 && (
                      <div className="mt-4 border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                          <i className="fas fa-chart-line mr-2 text-purple-500"></i>
                          Pension & Policy Projections
                        </h3>
                        <div className="space-y-2">
                          {pensionProjections.map((projection) => (
                            <div
                              key={projection.assetId}
                              className="p-3 rounded-lg border border-purple-200 bg-purple-50"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium text-gray-800">
                                    {projection.assetName}
                                  </div>
                                  <div className="text-xs text-purple-600 mt-1">
                                    Payout at age {projection.payoutAge}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-500">
                                    Current
                                  </div>
                                  <div
                                    className={`text-sm ${hideValues ? "text-gray-400" : "text-gray-600"}`}
                                  >
                                    {hideValues
                                      ? HIDDEN_VALUE
                                      : `${effectiveCurrency}${Math.round(projection.currentValue * effectiveFxRate).toLocaleString()}`}
                                  </div>
                                  <div className="text-xs text-purple-600 mt-2">
                                    Projected
                                  </div>
                                  <div
                                    className={`font-medium ${hideValues ? "text-gray-400" : "text-purple-700"}`}
                                  >
                                    {hideValues
                                      ? HIDDEN_VALUE
                                      : `${effectiveCurrency}${Math.round(projection.projectedValue * effectiveFxRate).toLocaleString()}`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary totals - use local values (reflects user's spendable category selections) */}
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
                        <>
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
                          <p className="text-xs text-gray-400">
                            FI uses spendable assets; illiquid assets add
                            long-term security.
                          </p>
                        </>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">
                          Blended Return Rate
                        </span>
                        <span className="font-medium text-blue-600">
                          {(blendedReturnRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between font-medium text-lg">
                        <span>
                          {t("retire.assets.spendableAtRetirement")}
                          {currentAge !== undefined && retirementAge && (
                            <span className="font-normal text-sm text-gray-500">
                              {" "}
                              (age {retirementAge},{" "}
                              {retirementAge - currentAge > 0
                                ? `${retirementAge - currentAge}yr`
                                : "now"}
                              )
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            hideValues ? "text-gray-400" : "text-orange-600"
                          }
                        >
                          {hideValues
                            ? HIDDEN_VALUE
                            : `${effectiveCurrency}${Math.round(
                                displayProjection?.preRetirementAccumulation
                                  ?.liquidAssetsAtRetirement
                                  ? // Backend projection available (already in display currency)
                                    displayProjection.preRetirementAccumulation
                                      .liquidAssetsAtRetirement -
                                      excludedPensionFV * effectiveFxRate
                                  : // No projection: use local values with FX conversion
                                    (liquidAssets +
                                      includedPensionFvDifferential) *
                                      effectiveFxRate,
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
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === "timeline" && (
            <>
              {!displayProjection ||
              displayProjection.yearlyProjections.length === 0 ? (
                <div className="bg-white rounded-xl shadow-md p-6">
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
                </div>
              ) : (
                <div className="space-y-4">
                  <CollapsibleSection
                    title="Wealth Journey"
                    icon="fa-chart-line"
                    iconColor="text-blue-500"
                    isOpen={openSections["wealthJourney"]}
                    onToggle={() => toggleSection("wealthJourney")}
                    headerRight={
                      fiAchievementAge ? (
                        <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
                          <button
                            onClick={() => setTimelineViewMode("traditional")}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              timelineViewMode === "traditional"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            Traditional
                          </button>
                          <button
                            onClick={() => setTimelineViewMode("fire")}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                              timelineViewMode === "fire"
                                ? "bg-white text-green-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            FIRE
                          </button>
                        </div>
                      ) : undefined
                    }
                  >
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={
                            chartDataWithBaseline.length > 0
                              ? chartDataWithBaseline
                              : displayProjection.yearlyProjections
                          }
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
                            domain={[
                              (dataMin: number) =>
                                Math.min(
                                  dataMin,
                                  retirementAge ? retirementAge - 3 : dataMin,
                                ),
                              "dataMax",
                            ]}
                            allowDataOverflow={true}
                            ticks={(() => {
                              // Generate ticks that always include key ages
                              const ages = fullJourneyData
                                .map((d) => d.age)
                                .filter((a): a is number => a !== undefined)
                              if (ages.length === 0) return undefined
                              const minAge = Math.min(...ages)
                              const maxAge = Math.max(...ages)
                              const range = maxAge - minAge
                              const step = range <= 30 ? 5 : 10
                              const ticks: number[] = []
                              // Regular interval ticks
                              for (
                                let age = Math.ceil(minAge / step) * step;
                                age <= maxAge;
                                age += step
                              ) {
                                ticks.push(age)
                              }
                              // Always include retirement age
                              if (
                                retirementAge &&
                                !ticks.includes(retirementAge)
                              ) {
                                ticks.push(retirementAge)
                              }
                              // Always include FI achievement age
                              if (
                                fiAchievementAge &&
                                !ticks.includes(fiAchievementAge)
                              ) {
                                ticks.push(fiAchievementAge)
                              }
                              return ticks.sort((a, b) => a - b)
                            })()}
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
                              if (name === "accumulationBalance")
                                return [formatted, "Working Years"]
                              if (name === "retirementBalance")
                                return [formatted, "Independence Years"]
                              if (name === "fireBalance")
                                return [formatted, "FIRE Path"]
                              if (name === "baselineBalance")
                                return [formatted, "Baseline"]
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
                                : value === "accumulationBalance"
                                  ? "Working Years"
                                  : value === "retirementBalance"
                                    ? "Independence Years"
                                    : value === "fireBalance"
                                      ? "FIRE Path"
                                      : value === "baselineBalance"
                                        ? "Baseline"
                                        : value
                            }
                          />
                          <ReferenceLine
                            y={0}
                            stroke="#ef4444"
                            strokeWidth={2}
                          />
                          {/* Independence years shaded area - show in traditional view */}
                          {timelineViewMode === "traditional" &&
                            retirementAge && (
                              <ReferenceArea
                                x1={retirementAge}
                                x2={lifeExpectancy}
                                fill="#f97316"
                                fillOpacity={0.15}
                                stroke="#f97316"
                                strokeOpacity={0.3}
                              />
                            )}
                          {/* Retirement age transition line - show in traditional view */}
                          {timelineViewMode === "traditional" &&
                            retirementAge && (
                              <ReferenceLine
                                x={retirementAge}
                                stroke="#f97316"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                label={{
                                  value: `Independence (${retirementAge})`,
                                  position: "top",
                                  fill: "#f97316",
                                  fontSize: 11,
                                }}
                              />
                            )}
                          {/* FI achievement age line - show in FIRE view */}
                          {timelineViewMode === "fire" && fiAchievementAge && (
                            <ReferenceLine
                              x={fiAchievementAge}
                              stroke="#22c55e"
                              strokeDasharray="3 3"
                              strokeWidth={2}
                              label={{
                                value: "FI",
                                position: "top",
                                fill: "#22c55e",
                                fontSize: 11,
                              }}
                            />
                          )}
                          {/* Total Wealth line - show in traditional view when non-spendable assets exist */}
                          {timelineViewMode === "traditional" &&
                            displayProjection.nonSpendableAtRetirement > 0 && (
                              <Line
                                type="monotone"
                                dataKey="totalWealth"
                                stroke="#22c55e"
                                strokeWidth={2}
                                dot={{ r: 2, fill: "#22c55e" }}
                                name="totalWealth"
                              />
                            )}
                          {/* Traditional path - Working years (blue) */}
                          {timelineViewMode === "traditional" && (
                            <Line
                              type="monotone"
                              dataKey="accumulationBalance"
                              stroke="#3b82f6"
                              strokeWidth={3}
                              dot={{ r: 3, fill: "#3b82f6" }}
                              name="accumulationBalance"
                              connectNulls={false}
                            />
                          )}
                          {/* Traditional path - Independence years (purple) */}
                          {timelineViewMode === "traditional" && (
                            <Line
                              type="monotone"
                              dataKey="retirementBalance"
                              stroke="#f97316"
                              strokeWidth={3}
                              dot={{ r: 3, fill: "#f97316" }}
                              name="retirementBalance"
                              connectNulls={false}
                            />
                          )}
                          {/* FIRE path - what happens if you retire at FI age */}
                          {timelineViewMode === "fire" &&
                            fiAchievementAge &&
                            adjustedProjection?.firePathProjections && (
                              <Line
                                type="monotone"
                                dataKey="fireBalance"
                                stroke="#22c55e"
                                strokeWidth={3}
                                dot={{ r: 3, fill: "#22c55e" }}
                                name="fireBalance"
                              />
                            )}
                          {/* Baseline comparison line - dashed gray, only when what-if is active */}
                          {baselineProjection && hasActiveWhatIf && (
                            <Line
                              type="monotone"
                              dataKey="baselineBalance"
                              stroke="#9ca3af"
                              strokeWidth={1.5}
                              strokeDasharray="6 4"
                              dot={false}
                              name="baselineBalance"
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Cash Flows"
                    icon="fa-exchange-alt"
                    iconColor="text-green-500"
                    isOpen={openSections["cashFlows"]}
                    onToggle={() => toggleSection("cashFlows")}
                  >
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={displayProjection.yearlyProjections.map(
                            (y) => ({
                              ...y,
                              negWithdrawals: -y.withdrawals,
                            }),
                          )}
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
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Scenario Impact"
                    icon="fa-calculator"
                    iconColor="text-orange-500"
                    isOpen={openSections["scenarioImpact"]}
                    onToggle={() => toggleSection("scenarioImpact")}
                  >
                    <ScenarioImpact
                      projection={displayProjection}
                      lifeExpectancy={lifeExpectancy}
                      currency={effectiveCurrency}
                      whatIfAdjustments={combinedAdjustments}
                      onLiquidationThresholdChange={(value) =>
                        setWhatIfAdjustments((prev) => ({
                          ...prev,
                          liquidationThreshold: value,
                        }))
                      }
                    />
                  </CollapsibleSection>

                  <CollapsibleSection
                    title="Income Breakdown"
                    icon="fa-table"
                    iconColor="text-indigo-500"
                    isOpen={openSections["incomeBreakdown"]}
                    onToggle={() => toggleSection("incomeBreakdown")}
                  >
                    <IncomeBreakdownTable
                      projections={displayProjection.yearlyProjections}
                      embedded
                    />
                  </CollapsibleSection>
                </div>
              )}
            </>
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
              currentAge={currentAge}
              retirementAge={retirementAge}
              lifeExpectancy={lifeExpectancy}
              monthlyInvestment={monthlyInvestment}
              whatIfAdjustments={combinedAdjustments}
              scenarioOverrides={scenarioOverrides}
              rentalIncome={rentalIncome}
              displayCurrency={displayCurrency ?? undefined}
              hideValues={hideValues}
              currency={effectiveCurrency}
              displayProjection={displayProjection}
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

      {/* Edit Details Modal - key forces remount after save */}
      <EditPlanDetailsModal
        key={`edit-modal-v${planVersion}`}
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
        currentAge={currentAge}
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
