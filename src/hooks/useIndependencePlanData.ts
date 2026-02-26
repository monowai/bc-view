import { useMemo } from "react"
import useSwr from "swr"
import { simpleFetcher, portfoliosKey } from "@utils/api/fetchHelper"
import { PlanResponse, QuickScenariosResponse, RetirementPlan, QuickScenario } from "types/independence"
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
  const { data: planData, error: planError, mutate: mutatePlan } = useSwr<PlanResponse>(
    id ? `/api/independence/plans/${id}` : null,
    id ? simpleFetcher(`/api/independence/plans/${id}`) : null,
    {
      revalidateOnMount: true,
      revalidateIfStale: true,
      dedupingInterval: 0,
    },
  )

  const isClientPlan = planData?.data?.clientId != null

  // For client plans, fetch the client's managed portfolios instead of adviser's own
  const { data: portfoliosData } = useSwr<PortfoliosResponse>(
    isClientPlan ? "/api/shares/managed" : portfoliosKey,
    simpleFetcher(isClientPlan ? "/api/shares/managed" : portfoliosKey),
  )

  // Fetch aggregated holdings to get category breakdown
  // For client plans, skip holdings fetch (adviser's token returns adviser's data)
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
