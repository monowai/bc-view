import React, { useMemo, useState } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"
import HoldingAnalysisPopup from "./HoldingAnalysisPopup"

interface AssetReviewPopupProps {
  ticker: string
  market?: string
  assetName?: string
  /**
   * The portfolio the review was opened from. When given, the reader can
   * move on to a Holding Analysis of their own position there.
   */
  portfolioCode?: string
  onClose: () => void
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes — reviews change slowly

function buildRequest(
  ticker: string,
  market: string | undefined,
  assetName: string | undefined,
): AnalysisRequest {
  return {
    cacheKey: `asset-review|${ticker}|${market || ""}`,
    // Blank: svc-agent asks its canned Asset Review question, built from
    // the context's tickers, assetName and market.
    query: "",
    label: `Asset Review — ${ticker}`,
    context: {
      page: "Asset Review",
      description: "Single-asset deep dive from the assets/lookup screen",
      tickers: ticker,
      market: market || "",
      assetName: assetName || "",
    },
    ttlMs: CACHE_TTL_MS,
  }
}

export default function AssetReviewPopup({
  ticker,
  market,
  assetName,
  portfolioCode,
  onClose,
}: AssetReviewPopupProps): React.ReactElement {
  const request = useMemo(
    () => buildRequest(ticker, market, assetName),
    [ticker, market, assetName],
  )
  // The review is about the asset only. A question about the reader's own
  // holding is its own conversation, never a follow-up in this thread.
  const [analysingHolding, setAnalysingHolding] = useState(false)
  if (analysingHolding && portfolioCode) {
    return (
      <HoldingAnalysisPopup
        ticker={ticker}
        market={market || ""}
        portfolioCode={portfolioCode}
        onClose={onClose}
      />
    )
  }
  const actions = portfolioCode ? (
    <button
      type="button"
      onClick={() => setAnalysingHolding(true)}
      className="px-3 py-1.5 rounded-md text-sm text-purple-700 hover:bg-purple-50 ring-1 ring-purple-200"
      title="Analyse your own position in this asset"
    >
      <i className="fas fa-magnifying-glass-chart mr-1"></i>
      Analyse my holding
    </button>
  ) : undefined
  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-microscope text-purple-600 mr-2"></i>
          Asset Review — {ticker}
          {market && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({market})
            </span>
          )}
        </span>
      }
      request={request}
      loadingLabel="Generating review..."
      onClose={onClose}
      actions={actions}
    />
  )
}
