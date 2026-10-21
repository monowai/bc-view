import useSwr, { KeyedMutator } from "swr"
import { WatchlistAlert } from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { watchlistAlertsKey } from "@utils/api/client/watchlist"

interface AlertsResponse {
  data: WatchlistAlert[]
}

interface UseWatchlistAlertsResult {
  /** undefined until the first load succeeds. Newest first, as svc-data sends them. */
  alerts: WatchlistAlert[] | undefined
  error: Error | undefined
  /** Replace the cached list, e.g. with what a dismiss returned. */
  setAlerts: (alerts: WatchlistAlert[]) => void
  mutate: KeyedMutator<AlertsResponse>
}

/**
 * The caller's watchlist target alerts. One SWR key, shared by the header
 * badge and the watchlist page, so a dismiss on the page updates the badge.
 */
export function useWatchlistAlerts(
  enabled = true,
  options: { refreshInterval?: number } = {},
): UseWatchlistAlertsResult {
  const { data, error, mutate } = useSwr<AlertsResponse>(
    enabled ? watchlistAlertsKey : null,
    simpleFetcher(watchlistAlertsKey),
    { revalidateOnFocus: false, ...options },
  )
  return {
    alerts: data ? (data.data ?? []) : undefined,
    error,
    setAlerts: (alerts) => {
      void mutate({ data: alerts }, { revalidate: false })
    },
    mutate,
  }
}
