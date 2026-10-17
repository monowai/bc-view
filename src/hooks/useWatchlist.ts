import useSwr from "swr"
import { Watchlist, WatchlistItem } from "types/beancounter"
import { simpleFetcher, watchlistKey } from "@utils/api/fetchHelper"

interface UseWatchlistResult {
  /** undefined until the first load succeeds. */
  items: WatchlistItem[] | undefined
  error: Error | undefined
  isLoading: boolean
  mutate: () => Promise<unknown>
}

/** The caller's watchlist — one per user; empty until they add an asset. */
export function useWatchlist(): UseWatchlistResult {
  const { data, error, mutate } = useSwr<{ data: Watchlist }>(
    watchlistKey,
    simpleFetcher(watchlistKey),
  )
  return {
    // Loaded but without items is an empty watchlist, not "still loading".
    items: data ? (data.data?.items ?? []) : undefined,
    error,
    isLoading: !data && !error,
    mutate,
  }
}
