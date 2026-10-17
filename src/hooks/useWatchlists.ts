import useSwr from "swr"
import { Watchlist, WatchlistSummary } from "types/beancounter"
import {
  simpleFetcher,
  watchlistKey,
  watchlistsKey,
} from "@utils/api/fetchHelper"

interface UseWatchlistsResult {
  watchlists: WatchlistSummary[]
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
}

export function useWatchlists(): UseWatchlistsResult {
  const { data, error, mutate } = useSwr<{ data: WatchlistSummary[] }>(
    watchlistsKey,
    simpleFetcher(watchlistsKey),
  )
  return {
    watchlists: data?.data || [],
    error,
    isLoading: !data && !error,
    mutate,
  }
}

interface UseWatchlistResult {
  watchlist: Watchlist | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
}

export function useWatchlist(id: string | undefined): UseWatchlistResult {
  const key = id ? watchlistKey(id) : null
  const { data, error, mutate } = useSwr<{ data: Watchlist }>(
    key,
    simpleFetcher(key || ""),
  )
  return {
    watchlist: data?.data,
    error,
    isLoading: !!key && !data && !error,
    mutate,
  }
}
