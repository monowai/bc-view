import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"

interface HoldingAnalysisPopupProps {
  ticker: string
  market: string
  portfolioCode: string
  onClose: () => void
}

// Holding facts move with every trade, so a reopened analysis is reused for
// less time than an Asset Review.
const CACHE_TTL_MS = 10 * 60 * 1000

/**
 * The Holding Analysis request: the asset review, enriched server-side with
 * the caller's own holding in `portfolioCode`. The client names the holding
 * and nothing more — svc-agent fetches weight, cost and the rest itself.
 */
export function buildHoldingAnalysisRequest(
  ticker: string,
  market: string,
  portfolioCode: string,
): AnalysisRequest {
  return {
    cacheKey: `holding-analysis|${portfolioCode}|${ticker}|${market}`,
    // Blank: svc-agent asks its canned Holding Analysis question.
    query: "",
    label: `Holding Analysis — ${ticker}`,
    context: {
      page: "Holding Analysis",
      tickers: ticker,
      market,
      portfolioCode,
    },
    ttlMs: CACHE_TTL_MS,
  }
}

export default function HoldingAnalysisPopup({
  ticker,
  market,
  portfolioCode,
  onClose,
}: HoldingAnalysisPopupProps): React.ReactElement {
  const request = useMemo(
    () => buildHoldingAnalysisRequest(ticker, market, portfolioCode),
    [ticker, market, portfolioCode],
  )
  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-magnifying-glass-chart text-purple-600 mr-2"></i>
          Holding Analysis — {ticker}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({portfolioCode})
          </span>
        </span>
      }
      request={request}
      loadingLabel="Analysing your holding..."
      onClose={onClose}
    />
  )
}
