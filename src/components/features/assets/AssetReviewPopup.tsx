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
  const nameLabel = assetName ? ` (${assetName})` : ""
  const marketLabel = market ? ` listed on ${market}` : ""
  return {
    cacheKey: `asset-review|${ticker}|${market || ""}`,
    query:
      `Produce an Asset Review for ${ticker}${nameLabel}${marketLabel}. ` +
      `Cover company and sector context, current sentiment from recent news, ` +
      `corporate-action history (dividends and splits in the last 12 months), ` +
      `and qualitative risk callouts. Stay at the ticker level — do not assume ` +
      `the user holds it.`,
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
