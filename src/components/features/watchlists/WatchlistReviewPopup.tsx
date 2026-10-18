import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"

interface WatchlistReviewPopupProps {
  /** Watched asset ids; they key the cached brief, the agent reads the list itself. */
  assetIds: string[]
  onClose: () => void
}

// The agent's Watchlist domain prompt carries the method and output shape;
// this opening turn only names the brief so the thread reads well in chat.
const WATCHLIST_BRIEF_PROMPT =
  "Review my watchlist for momentum and fundamentals. Which names are trending, which are fading, and which deserve a closer look?"

const CACHE_TTL_MS = 30 * 60 * 1000

export function watchlistReviewKey(assetIds: string[]): string {
  return `watchlist-review|${[...assetIds].sort().join(",")}`
}

export default function WatchlistReviewPopup({
  assetIds,
  onClose,
}: WatchlistReviewPopupProps): React.ReactElement {
  const cacheKey = watchlistReviewKey(assetIds)
  const request = useMemo<AnalysisRequest>(
    () => ({
      cacheKey,
      query: WATCHLIST_BRIEF_PROMPT,
      label: "AI Summary — Watchlist",
      ttlMs: CACHE_TTL_MS,
      context: {
        page: "Watchlist",
        description:
          "AI Summary popup for the user's watchlist (momentum and fundamentals).",
      },
    }),
    [cacheKey],
  )
  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-robot text-blue-500 mr-2"></i>
          {"AI Summary — Watchlist"}
        </span>
      }
      request={request}
      loadingLabel="Generating summary..."
      onClose={onClose}
    />
  )
}
