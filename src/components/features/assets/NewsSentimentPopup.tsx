import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"

interface NewsSentimentPopupProps {
  ticker: string
  market?: string
  assetName?: string
  onClose: () => void
}

const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function buildRequest(
  ticker: string,
  market: string | undefined,
  assetName: string | undefined,
): AnalysisRequest {
  const nameLabel = assetName ? ` (${assetName})` : ""
  const marketLabel = market ? ` listed on the ${market} exchange` : ""
  return {
    cacheKey: `news|${ticker}|${market || ""}`,
    query:
      `Get news and sentiment for ${ticker}${nameLabel}${marketLabel}. ` +
      `If live news coverage is unavailable for this ticker/exchange, ` +
      `provide a concise general-knowledge summary of the company, its sector, ` +
      `recent themes, and qualitative sentiment — clearly labelled as general ` +
      `knowledge, not live news. ` +
      `Start the response directly with the markdown heading — no preamble, ` +
      `no lead-in sentence about coverage availability or what you are about ` +
      `to do. State the general-knowledge caveat only as a short line directly ` +
      `under the heading.`,
    label: `News & Sentiment — ${ticker}`,
    context: {
      page: "News & Sentiment",
      description: "Quick news lookup for a single asset",
      tickers: ticker,
      market: market || "",
      assetName: assetName || "",
    },
    ttlMs: CACHE_TTL_MS,
  }
}

export default function NewsSentimentPopup({
  ticker,
  market,
  assetName,
  onClose,
}: NewsSentimentPopupProps): React.ReactElement {
  const request = useMemo(
    () => buildRequest(ticker, market, assetName),
    [ticker, market, assetName],
  )
  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-newspaper text-blue-600 mr-2"></i>
          News &amp; Sentiment — {ticker}
          {market && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({market})
            </span>
          )}
        </span>
      }
      request={request}
      loadingLabel="Fetching news..."
      onClose={onClose}
    />
  )
}
