import React, { useEffect, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { AgentResponse } from "types/agent"

interface NewsSentimentPopupProps {
  ticker: string
  onClose: () => void
}

// Module-level cache: ticker -> { response, fetchedAt }
const newsCache = new Map<string, { response: string; fetchedAt: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function clearNewsCache(): void {
  newsCache.clear()
}

export default function NewsSentimentPopup({
  ticker,
  onClose,
}: NewsSentimentPopupProps): React.ReactElement {
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const cached = newsCache.get(ticker)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setResponse(cached.response)
      setIsLoading(false)
      return () => {}
    }

    let cancelled = false

    async function fetchNews(): Promise<void> {
      try {
        const res = await fetch("/api/agent/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `Get news and sentiment for ${ticker}`,
            context: {
              page: "News & Sentiment",
              description: "Quick news lookup for a single asset",
              tickers: ticker,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          if (!cancelled) setError(err.message || `HTTP ${res.status}`)
          return
        }
        const data: AgentResponse = await res.json()
        if (!cancelled) {
          setResponse(data.response)
          newsCache.set(ticker, {
            response: data.response,
            fetchedAt: Date.now(),
          })
        }
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to fetch news")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchNews()
    return () => {
      cancelled = true
    }
  }, [ticker])

  return (
    <Dialog
      title={
        <span>
          <i className="fas fa-newspaper text-blue-600 mr-2"></i>
          News — {ticker}
        </span>
      }
      onClose={onClose}
      maxWidth="xl"
      scrollable
    >
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
          <Spinner />
          <span>Fetching news...</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Sorry, an error occurred: {error}
        </div>
      )}
      {response && (
        <div className="prose prose-sm max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{response}</Markdown>
        </div>
      )}
    </Dialog>
  )
}
