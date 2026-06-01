import { useMemo } from "react"
import useSwr from "swr"
import {
  simpleFetcher,
  portfoliosKey,
  sharesManagedKey,
} from "@utils/api/fetchHelper"
import {
  PlanResponse,
  QuickScenariosResponse,
  RetirementPlan,
  QuickScenario,
} from "types/independence"
import {
  Portfolio,
  HoldingContract,
  PortfolioShare,
} from "types/beancounter"
import type { KeyedMutator } from "swr"
import { parseExcludedPortfolioIds } from "@lib/independence/planHelpers"

interface PortfoliosResponse {
  data: Portfolio[]
}

export interface UseIndependencePlanDataResult {
  plan: RetirementPlan | undefined
  planError: Error | undefined
  isClientPlan: boolean
  portfoliosData: PortfoliosResponse | undefined
  holdingsData: HoldingContract | undefined
  holdingsLoading: boolean
  refreshHoldings: () => void
  isRefreshingHoldings: boolean
  quickScenarios: QuickScenario[]
  availableCurrencies: { code: string; name: string; symbol: string }[]
  mutatePlan: KeyedMutator<PlanResponse>
}

export function useIndependencePlanData(
  id: string | string[] | undefined,
  /**
   * Plan owner's SystemUser.id when the caller doesn't own the plan
   * (shared INDEPENDENCE_PLAN). When set, holdings are filtered to
   * portfolios owned by that SystemUser. Caller still needs an accepted
   * portfolio share for those portfolios — svc-position's canView
   * decides what comes back; mismatched ids are silently dropped. Pass
   * undefined for owned plans.
   */
  ownerSystemUserId?: string,
): UseIndependencePlanDataResult {
  const normalizedId = Array.isArray(id) ? id[0] : id
  const planKey = normalizedId
    ? `/api/independence/plans/${normalizedId}`
    : null

  const {
    data: planData,
    error: planError,
    mutate: mutatePlan,
  } = useSwr<PlanResponse>(planKey, planKey ? simpleFetcher(planKey) : null, {
    revalidateOnMount: true,
    revalidateIfStale: true,
    dedupingInterval: 0,
  })

  const isClientPlan = planData?.data?.clientId != null
  const hasResolvedPlan = planData?.data != null

  // For client plans, fetch the client's managed portfolios instead of adviser's own
  // Wait for plan to resolve before choosing endpoint
  const portfoliosEndpoint = hasResolvedPlan
    ? isClientPlan
      ? "/api/shares/managed"
      : portfoliosKey
    : null
  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    portfoliosEndpoint,
    portfoliosEndpoint ? simpleFetcher(portfoliosEndpoint) : null,
  )

  // Shared-plan caller: also pull the portfolios shared WITH them so we
  // can spot the plan owner's portfolios for category-breakdown filtering.
  // `/api/shares/managed` returns PortfolioShare rows; the `.portfolio`
  // field has the share-target details. Only fetched when needed.
  const { data: managedSharesData } = useSwr<{ data: PortfolioShare[] }>(
    ownerSystemUserId ? sharesManagedKey : null,
    ownerSystemUserId ? simpleFetcher(sharesManagedKey) : null,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  )

  // Owned-plan path: filter by codes (existing contract). Shared-plan
  // path: filter by ids — codes can collide across users (Mike's "SGD"
  // vs Ruby's "SGD"), so codes-based filtering would aggregate both and
  // re-introduce the leak. The shared-plan filter excludes the viewer's
  // own portfolios outright via the owner.id == ownerSystemUserId check.
  const ownedPlanFilter = useMemo(() => {
    if (!portfoliosData?.data || !planData?.data) return null
    if (ownerSystemUserId) return null
    const excluded = new Set(
      parseExcludedPortfolioIds(planData.data.excludedPortfolioIds),
    )
    const pool = portfoliosData.data.filter((p) => !excluded.has(p.id))
    if (excluded.size === 0) return null // null = fetch all
    return pool.length > 0 ? pool.map((p) => p.code).join(",") : null
  }, [portfoliosData, planData, ownerSystemUserId])

  const sharedPlanOwnerPortfolioIds = useMemo(() => {
    if (!ownerSystemUserId || !portfoliosData?.data || !planData?.data) {
      return null
    }
    const excluded = new Set(
      parseExcludedPortfolioIds(planData.data.excludedPortfolioIds),
    )
    // Pool of caller-viewable portfolios = owned + accepted shares.
    // `/portfolios` is owned-only; `/shares/managed` adds share targets.
    const pool: Portfolio[] = []
    const seen = new Set<string>()
    for (const p of portfoliosData.data) {
      if (!excluded.has(p.id) && !seen.has(p.id)) {
        pool.push(p)
        seen.add(p.id)
      }
    }
    for (const s of managedSharesData?.data ?? []) {
      const p = s.portfolio
      if (p && !excluded.has(p.id) && !seen.has(p.id)) {
        pool.push(p)
        seen.add(p.id)
      }
    }
    const owned = pool.filter((p) => p.owner?.id === ownerSystemUserId)
    // Empty string = signal to caller "skip holdings fetch entirely so
    // we don't fall back to the caller-scoped aggregate"; null = no
    // shared-plan path (use the owned-plan codes filter).
    return owned.length > 0 ? owned.map((p) => p.id).join(",") : ""
  }, [portfoliosData, planData, ownerSystemUserId, managedSharesData])

  // Fetch aggregated holdings to get category breakdown
  // For client plans, skip holdings fetch (adviser's token returns adviser's data)
  // Wait for plan to resolve before deciding
  const planCurrency = planData?.data?.expensesCurrency
  const holdingsEndpoint = useMemo(() => {
    if (!hasResolvedPlan || isClientPlan) return null
    // Shared-plan empty-string id-set = caller has plan-share but no
    // portfolio-shares from the owner. Skip the holdings fetch entirely
    // so we don't accidentally hit svc-position's "no codes / no ids =
    // all callers' portfolios" fallback (which would re-introduce the
    // leak).
    if (sharedPlanOwnerPortfolioIds === "") return null
    const params = new URLSearchParams({ asAt: "today" })
    if (sharedPlanOwnerPortfolioIds) {
      params.set("ids", sharedPlanOwnerPortfolioIds)
    } else if (ownedPlanFilter) {
      params.set("codes", ownedPlanFilter)
    }
    if (planCurrency) params.set("currency", planCurrency)
    return `/api/holdings/aggregated?${params.toString()}`
  }, [
    hasResolvedPlan,
    isClientPlan,
    ownedPlanFilter,
    sharedPlanOwnerPortfolioIds,
    planCurrency,
  ])
  const {
    data: holdingsResponse,
    isLoading: holdingsLoading,
    mutate: refreshHoldings,
    isValidating: isRefreshingHoldings,
  } = useSwr<{ data: HoldingContract }>(
    holdingsEndpoint,
    holdingsEndpoint ? simpleFetcher(holdingsEndpoint) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
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

  // Fetch available currencies
  const { data: currenciesData } = useSwr<{
    data: { code: string; name: string; symbol: string }[]
  }>("/api/currencies", simpleFetcher("/api/currencies"))
  const availableCurrencies = currenciesData?.data || []

  return {
    plan: planData?.data,
    planError,
    isClientPlan,
    portfoliosData,
    holdingsData,
    holdingsLoading,
    refreshHoldings: () => refreshHoldings(),
    isRefreshingHoldings,
    quickScenarios,
    availableCurrencies,
    mutatePlan,
  }
}
