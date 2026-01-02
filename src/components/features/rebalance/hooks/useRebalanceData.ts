import useSwr, { KeyedMutator } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

/**
 * Generic result type for rebalance data hooks.
 */
export interface UseDataResult<T> {
  data: T | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: KeyedMutator<{ data: T }>
}

/**
 * Generic result type for rebalance list data hooks.
 */
export interface UseListResult<T> {
  data: T[]
  error: Error | undefined
  isLoading: boolean
  mutate: KeyedMutator<{ data: T[] }>
}

/**
 * Generic hook for fetching single rebalance data items.
 * Wraps SWR with consistent patterns for the rebalance feature.
 *
 * @param key - SWR cache key (null to disable fetching)
 * @returns UseDataResult with typed data
 *
 * @example
 * const { data: model, isLoading } = useRebalanceItem<ModelDto>(
 *   modelId ? `/api/rebalance/models/${modelId}` : null
 * )
 */
export function useRebalanceItem<T>(
  key: string | null
): UseDataResult<T> {
  const { data, error, isLoading, mutate } = useSwr<{ data: T }>(
    key,
    key ? simpleFetcher(key) : null
  )
  return {
    data: data?.data,
    error,
    isLoading,
    mutate,
  }
}

/**
 * Generic hook for fetching rebalance list data.
 * Wraps SWR with consistent patterns for the rebalance feature.
 *
 * @param key - SWR cache key (null to disable fetching)
 * @returns UseListResult with typed array data
 *
 * @example
 * const { data: models, isLoading } = useRebalanceList<ModelDto>("/api/rebalance/models")
 */
export function useRebalanceList<T>(
  key: string | null
): UseListResult<T> {
  const { data, error, isLoading, mutate } = useSwr<{ data: T[] }>(
    key,
    key ? simpleFetcher(key) : null
  )
  return {
    data: data?.data || [],
    error,
    isLoading,
    mutate,
  }
}
