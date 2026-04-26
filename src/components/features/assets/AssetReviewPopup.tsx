import React, { useEffect, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { AgentResponse } from "types/agent"

interface AssetReviewPopupProps {
  ticker: string
  market?: string
  assetName?: string
  onClose: () => void
}

// Module-level cache: ticker|market -> { response, fetchedAt }. Mirrors the
// NewsSentimentPopup cache; reviews are cheaper to refresh than news but
// repeated opens within minutes shouldn't re-hit the LLM.
const reviewCache = new Map<string, { response: string; fetchedAt: number }>()
const inFlight = new Map<string, Promise<string>>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes — reviews change slowly

export function clearReviewCache(): void {
  reviewCache.clear()
  inFlight.clear()
}

const cacheKey = (ticker: string, market?: string): string =>
  `${ticker}|${market || ""}`

async function performFetch(
  key: string,
  ticker: string,
  market: string | undefined,
  assetName: string | undefined,
): Promise<string> {
  const nameLabel = assetName ? ` (${assetName})` : ""
  const marketLabel = market ? ` listed on ${market}` : ""
  const query =
    `Produce an Asset Review for ${ticker}${nameLabel}${marketLabel}. ` +
    `Cover company and sector context, current sentiment from recent news, ` +
    `corporate-action history (dividends and splits in the last 12 months), ` +
    `and qualitative risk callouts. Stay at the ticker level — do not assume ` +
    `the user holds it.`

  const res = await fetch("/api/agent/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      context: {
        page: "Asset Review",
        description: "Single-asset deep dive from the assets/lookup screen",
        tickers: ticker,
        market: market || "",
        assetName: assetName || "",
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const data: AgentResponse = await res.json()
  reviewCache.set(key, { response: data.response, fetchedAt: Date.now() })
  return data.response
}

function fetchReviewOnce(
  key: string,
  ticker: string,
  market: string | undefined,
  assetName: string | undefined,
): Promise<string> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = performFetch(key, ticker, market, assetName).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

export default function AssetReviewPopup({
  ticker,
  market,
  assetName,
  onClose,
}: AssetReviewPopupProps): React.ReactElement {
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const key = cacheKey(ticker, market)
    const cached = reviewCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setResponse(cached.response)
      setIsLoading(false)
      return () => {}
    }

    let cancelled = false
    fetchReviewOnce(key, ticker, market, assetName)
      .then((text) => {
        if (!cancelled) setResponse(text)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to fetch review")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ticker, market, assetName])

  return (
    <Dialog
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
      onClose={onClose}
      maxWidth="4xl"
      scrollable
    >
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
          <Spinner />
          <span>Generating review...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Sorry, an error occurred: {error}
        </div>
      )}
      {response && (
        <div
          className="prose prose-sm sm:prose-base max-w-none
            prose-headings:text-slate-900 prose-headings:font-semibold
            prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
            prose-h2:mt-6 prose-h2:mb-3 prose-h3:mt-4 prose-h3:mb-2
            prose-p:text-slate-700 prose-p:leading-relaxed
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-slate-900
            prose-ul:my-3 prose-li:my-1
            prose-table:text-sm"
        >
          <Markdown remarkPlugins={[remarkGfm]}>{response}</Markdown>
        </div>
      )}
    </Dialog>
  )
}
