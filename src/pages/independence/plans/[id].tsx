import React, { useState, useMemo, useEffect, useRef } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import Head from "next/head"
import Link from "next/link"
import { useRouter } from "next/router"
import useSwr, { mutate } from "swr"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { PlanResponse, QuickScenariosResponse } from "types/independence"
import {
  Portfolio,
  HoldingContract,
  FxResponse,
  Position,
} from "types/beancounter"
import { transformToAllocationSlices } from "@lib/allocation/aggregateHoldings"
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
  SaveScenarioDialog,
  EditPlanDetailsModal,
  MonteCarloTab,
  FiSummaryBar,
  PlanViewHeader,
  PlanTabNavigation,
  AnalysisToolbar,
  DetailsTabContent,
  AssetsTabContent,
  TimelineTabContent,
} from "@components/features/independence"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import {
  parseManualAssets,
  hasManualAssets,
  manualAssetsToSlices,
  PensionProjection,
} from "@lib/independence/planHelpers"

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
  // Version counter to force modal re-initialization after save
  const [planVersion, setPlanVersion] = useState(0)

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

  const isClientPlan = planData?.data?.clientId != null
  const [isTransferring, setIsTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)

  // For client plans, fetch the client's managed portfolios instead of adviser's own
  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    isClientPlan ? "/api/shares/managed" : portfoliosKey,
    simpleFetcher(isClientPlan ? "/api/shares/managed" : portfoliosKey),
  )

  // Fetch aggregated holdings to get category breakdown
  // For client plans, skip holdings fetch (adviser's token returns adviser's data)
  // Disable auto-revalidation - only refresh on manual action for performance
  // Use dedupingInterval for caching across page refreshes
  const {
    data: holdingsResponse,
    isLoading: holdingsLoading,
    mutate: refreshHoldings,
    isValidating: isRefreshingHoldings,
  } = useSwr<{ data: HoldingContract }>(
    isClientPlan ? null : "/api/holdings/aggregated?asAt=today",
    isClientPlan ? null : simpleFetcher("/api/holdings/aggregated?asAt=today"),
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
  const categorySlices = useMemo(() => {
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
  useEffect(() => {
    const fetchPensionProjections = async (): Promise<void> => {
      if (!lumpSumAssets.length || currentAge === undefined) {
        setPensionProjections([])
        return
      }

      const projections: PensionProjection[] = []

      for (const asset of lumpSumAssets) {
        const { config, assetName, currentValue, category } = asset

        if (!config.payoutAge || !config.expectedReturnRate) {
          continue
        }

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
      const selected = quickScenarios.filter((s) =>
        selectedScenarioIds.includes(s.id),
      )

      result = selected.reduce(
        (acc, scenario) => ({
          ...acc,
          retirementAgeOffset:
            acc.retirementAgeOffset + scenario.retirementAgeOffset,
          returnRateOffset: acc.returnRateOffset + scenario.returnRateOffset,
          inflationOffset: acc.inflationOffset + scenario.inflationOffset,
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
        setTransferError(
          errorData.message ||
            t("client.transfer.failed", "Failed to transfer plan"),
        )
      }
    } catch (err) {
      console.error("Failed to transfer plan:", err)
      setTransferError(t("client.transfer.failed", "Failed to transfer plan"))
    } finally {
      setIsTransferring(false)
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
        const response = await fetch(`/api/independence/plans/${plan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })
        if (response.ok) {
          const updatedPlan = await response.json()
          await mutate(`/api/independence/plans/${id}`, updatedPlan, false)
          setScenarioOverrides({})
          setShowSaveDialog(false)
          setPlanVersion((v) => v + 1)
        }
      } else {
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
                  {t("client.managingFor", "Managing for client")}:{" "}
                  {plan.clientId}
                </span>
              </div>
              <button
                onClick={handleTransfer}
                disabled={isTransferring}
                className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isTransferring
                  ? t("transferring", "Transferring...")
                  : t("client.transfer", "Transfer to Client")}
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

          {/* FIRE Summary Bar */}
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
                  <Spinner label="Calculating FI metrics..." />
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
          {activeTab === "details" && (
            <DetailsTabContent
              plan={plan}
              scenarioOverrides={scenarioOverrides}
              combinedAdjustments={combinedAdjustments}
              projection={adjustedProjection}
              rentalIncome={rentalIncome}
              effectiveCurrency={effectiveCurrency}
              planCurrency={planCurrency}
              onEditDetails={() => setShowEditDetailsModal(true)}
            />
          )}

          {activeTab === "assets" && (
            <AssetsTabContent
              projection={adjustedProjection}
              effectivePlanValues={effectivePlanValues}
              categorySlices={categorySlices}
              spendableCategories={spendableCategories}
              onToggleCategory={toggleCategory}
              pensionProjections={pensionProjections}
              totalAssets={totalAssets}
              liquidAssets={liquidAssets}
              blendedReturnRate={blendedReturnRate}
              currentAge={currentAge}
              retirementAge={retirementAge}
              effectiveCurrency={effectiveCurrency}
              effectiveFxRate={effectiveFxRate}
              fireDataReady={fireDataReady}
              isCalculating={isCalculating}
              holdingsLoaded={!!holdingsData}
              usingManualAssets={usingManualAssets}
              isRefreshingHoldings={isRefreshingHoldings}
              onRefreshHoldings={() => refreshHoldings()}
              excludedPensionFV={excludedPensionFV}
              includedPensionFvDifferential={includedPensionFvDifferential}
            />
          )}

          {activeTab === "timeline" && (
            <TimelineTabContent
              projection={adjustedProjection}
              baselineProjection={baselineProjection}
              retirementAge={retirementAge}
              lifeExpectancy={lifeExpectancy}
              combinedAdjustments={combinedAdjustments}
              hideValues={hideValues}
              isCalculating={isCalculating}
              effectiveCurrency={effectiveCurrency}
              onLiquidationThresholdChange={(value) =>
                setWhatIfAdjustments((prev) => ({
                  ...prev,
                  liquidationThreshold: value,
                }))
              }
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
