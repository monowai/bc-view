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

  // Compute included portfolio codes (all minus excluded).
  // Shared plans further filter to portfolios owned by the plan owner —
  // surfacing the viewer's own portfolios alongside would replay the
  // category-leak bug the M2M projection path was built to plug.
  const includedPortfolioCodes = useMemo(() => {
    if (!portfoliosData?.data || !planData?.data) return null
    const excluded = new Set(
      parseExcludedPortfolioIds(planData.data.excludedPortfolioIds),
    )
    let pool = portfoliosData.data.filter((p) => !excluded.has(p.id))
    if (ownerSystemUserId) {
      // Pool of caller-viewable portfolios = owned + accepted shares.
      // Mike's `/portfolios` is owned-only; pull share-target portfolios
      // from `/shares/managed` and union them.
      const shared =
        managedSharesData?.data
          ?.map((s) => s.portfolio)
          ?.filter((p): p is Portfolio => !!p && !excluded.has(p.id)) ?? []
      const seen = new Set(pool.map((p) => p.id))
      for (const p of shared) {
        if (!seen.has(p.id)) {
          pool.push(p)
          seen.add(p.id)
        }
      }
      pool = pool.filter((p) => p.owner?.id === ownerSystemUserId)
      // No matching portfolios = caller has plan share but not portfolio
      // shares. Empty string signals "skip holdings fetch" downstream so
      // we don't fall back to the caller-scoped aggregate.
      return pool.length > 0 ? pool.map((p) => p.code).join(",") : ""
    }
    if (excluded.size === 0) return null // null = fetch all
    return pool.length > 0 ? pool.map((p) => p.code).join(",") : null
  }, [portfoliosData, planData, ownerSystemUserId, managedSharesData])

  // Fetch aggregated holdings to get category breakdown
  // For client plans, skip holdings fetch (adviser's token returns adviser's data)
  // Wait for plan to resolve before deciding
  const planCurrency = planData?.data?.expensesCurrency
  const holdingsEndpoint = useMemo(() => {
    if (!hasResolvedPlan || isClientPlan) return null
    // Empty-string codes means a shared-plan caller with no portfolio
    // shares from the plan owner — skip the fetch entirely so we don't
    // accidentally hit svc-position's "no codes = all callers'
    // portfolios" fallback (which would re-introduce the leak).
    if (includedPortfolioCodes === "") return null
    const params = new URLSearchParams({ asAt: "today" })
    if (includedPortfolioCodes) params.set("codes", includedPortfolioCodes)
    if (planCurrency) params.set("currency", planCurrency)
    return `/api/holdings/aggregated?${params.toString()}`
  }, [hasResolvedPlan, isClientPlan, includedPortfolioCodes, planCurrency])
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
