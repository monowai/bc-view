import { useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import {
  PlanResponse,
  QuickScenariosResponse,
  RetirementPlan,
  QuickScenario,
} from "types/independence"
import { Portfolio, HoldingContract } from "types/beancounter"
import type { KeyedMutator } from "swr"

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

  // Fetch aggregated holdings to get category breakdown
  // For client plans, skip holdings fetch (adviser's token returns adviser's data)
  // Wait for plan to resolve before deciding
  const holdingsEndpoint =
    hasResolvedPlan && !isClientPlan
      ? "/api/holdings/aggregated?asAt=today"
      : null
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
