import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"

interface AssetReviewPopupProps {
  ticker: string
  market?: string
  assetName?: string
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
  onClose,
}: AssetReviewPopupProps): React.ReactElement {
  const request = useMemo(
    () => buildRequest(ticker, market, assetName),
    [ticker, market, assetName],
  )
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
    />
  )
}
