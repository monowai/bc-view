import React, { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"

export type PortfolioReviewTarget =
  | { kind: "portfolio"; id: string; code: string; name: string }
  | { kind: "aggregated"; codes: string[] }

interface PortfolioReviewPopupProps {
  target: PortfolioReviewTarget
  onClose: () => void
}

// Daily portfolio briefing prompt. Frames the agent as a financial columnist
// writing a 250–400 word morning read. Section order is fixed: headline →
// drivers → patterns → longer arc (XIRR vs day) → what to watch.
const DAILY_BRIEFING_PROMPT = `Role: You are a financial columnist writing a daily portfolio briefing. Your tone is that of a seasoned markets writer — informed, measured, and contextual. You explain why things moved, not just what moved.

Inputs available to you:
\t• Portfolio holdings (ETFs and individual stocks) with weights
\t• Day's return (portfolio and per-holding)
\t• XIRR (portfolio and per-holding where meaningful)
\t• News feed for holdings and broader markets

Your brief should cover, in this order:
\t1. The headline — One or two sentences. How did the portfolio do today, and is that consistent with or divergent from broader market behaviour? Lead with the number, then the context.
\t2. What drove it — Identify the 2–4 holdings (or sectors/themes) that contributed most to the day's move, positive or negative. Tie movements to news or macro factors where the news feed supports it. Avoid spurious causation — if a stock moved without clear news, say so.
\t3. Patterns and themes — Step back. Are the day's moves part of a pattern (rate-sensitive names selling off together, a rotation into defensives, concentration risk showing up)? Is the portfolio behaving as a coherent set of bets or as uncorrelated noise?
\t4. The longer arc — Briefly contrast the day against XIRR. Is today's move material against the long-run trajectory, or noise? Flag any holding whose XIRR is meaningfully diverging from thesis (sustained underperformance, a winner the portfolio is becoming concentrated in).
\t5. What to watch — One or two forward-looking items from the news feed: an earnings date, a macro print, a pending catalyst. No predictions, just the calendar.

Style rules:
\t• Front-load every section. The point comes first, the supporting detail after.
\t• Numbers in context. "Up 0.8%, against the S&P's 1.2%" beats "up 0.8%."
\t• No hedging filler ("it's worth noting that…", "interestingly…"). Cut it.
\t• No recommendations to buy or sell. You're a columnist, not an advisor.
\t• If data is missing or news is thin, say so plainly rather than padding.
\t• Length: roughly 250–400 words. A morning read, not a research note.`

// Module-level cache: key -> { response, fetchedAt }. Only fully-completed
// streams populate the cache; aborted runs are not cached so the user can
// retry by reopening.
const reviewCache = new Map<string, { response: string; fetchedAt: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

export function clearPortfolioReviewCache(): void {
  reviewCache.clear()
}

function targetKey(target: PortfolioReviewTarget): string {
  if (target.kind === "portfolio") return `P|${target.id}`
  return `A|${[...target.codes].sort().join(",")}`
}

function targetTitle(target: PortfolioReviewTarget): string {
  if (target.kind === "portfolio") return target.name
  if (target.codes.length === 0) return "Aggregated Holdings"
  if (target.codes.length === 1) return `Aggregated — ${target.codes[0]}`
  return `Aggregated — ${target.codes.length} portfolios`
}

function buildRequest(target: PortfolioReviewTarget): {
  query: string
  context: Record<string, unknown>
} {
  if (target.kind === "portfolio") {
    return {
      query: DAILY_BRIEFING_PROMPT,
      context: {
        page: "Portfolio Review",
        description:
          "AI Summary popup for a single portfolio's holdings (daily-read).",
        portfolioId: target.id,
        portfolioCode: target.code,
        portfolioName: target.name,
      },
    }
  }
  return {
    query: DAILY_BRIEFING_PROMPT,
    context: {
      page: "Portfolio Review",
      description:
        "AI Summary popup for aggregated holdings across portfolios (daily-read).",
      portfolioCodes: target.codes,
    },
  }
}

function describeStreamError(code: string): string {
  switch (code) {
    case "provider-quota":
      return "the AI provider has run out of credit. Please ask the site owner to top up the Anthropic billing balance."
    case "provider-rate":
      return "the AI provider is rate-limiting requests. Please wait a moment and try again."
    case "provider-timeout":
      return "the AI provider took too long to respond. Please try again."
    case "agent-error":
      return "the agent failed to process your request. Please try again."
    default:
      return code
  }
}

export default function PortfolioReviewPopup({
  target,
  onClose,
}: PortfolioReviewPopupProps): React.ReactElement {
  const [response, setResponse] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const key = targetKey(target)

  const cancel = (): void => {
    abortRef.current?.abort()
    setIsLoading(false)
  }

  useEffect(() => {
    const cached = reviewCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setResponse(cached.response)
      setIsLoading(false)
      return () => {}
    }

    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setError(null)
    setResponse("")

    const run = async (): Promise<void> => {
      const { query, context } = buildRequest(target)
      let accumulated = ""
      let streamError: string | null = null
      try {
        const res = await fetch("/api/agent/query/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ query, context }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""

        // SSE event blocks delimited by blank line; each block carries an
        // `event:` line and one or more `data:` lines. Accept both `\n\n`
        // and `\r\n\r\n` separators — proxies (CDN / load balancer) may
        // normalise line endings. Don't strip leading space from `data:`
        // payloads — Spring's SSE writer treats the space as content.
        const flush = (block: string): void => {
          let event = "message"
          const dataLines: string[] = []
          for (const raw of block.split(/\r?\n/)) {
            if (raw.startsWith(":")) continue
            if (raw.startsWith("event:")) {
              event = raw.slice(6).trim()
            } else if (raw.startsWith("data:")) {
              dataLines.push(raw.slice(5))
            }
          }
          const data = dataLines.join("\n")
          if (event === "token") {
            accumulated += data
            setResponse(accumulated)
          } else if (event === "error") {
            streamError = data || "stream-error"
          }
        }

        const findSeparator = (
          buf: string,
        ): { index: number; len: number } | null => {
          const lf = buf.indexOf("\n\n")
          const crlf = buf.indexOf("\r\n\r\n")
          if (lf === -1 && crlf === -1) return null
          if (lf === -1) return { index: crlf, len: 4 }
          if (crlf === -1) return { index: lf, len: 2 }
          return crlf < lf
            ? { index: crlf, len: 4 }
            : { index: lf, len: 2 }
        }

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          let sep = findSeparator(buffer)
          while (sep !== null) {
            const block = buffer.slice(0, sep.index)
            buffer = buffer.slice(sep.index + sep.len)
            if (block.length > 0) flush(block)
            sep = findSeparator(buffer)
          }
        }
        if (buffer.trim().length > 0) flush(buffer)

        if (streamError) {
          setError(describeStreamError(streamError))
        } else if (accumulated.length > 0) {
          reviewCache.set(key, {
            response: accumulated,
            fetchedAt: Date.now(),
          })
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : "Failed to fetch review")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [key, target])

  const showSpinner = isLoading && response.length === 0

  const cancelButton = isLoading ? (
    <button
      type="button"
      onClick={cancel}
      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 ring-1 ring-slate-200"
      aria-label="Cancel summary generation"
      title="Cancel"
    >
      <i className="fas fa-stop text-[10px] mr-1"></i>
      Cancel
    </button>
  ) : null

  return (
    <Dialog
      title={
        <span className="flex items-center">
          <i className="fas fa-robot text-blue-500 mr-2"></i>
          AI Summary — {targetTitle(target)}
        </span>
      }
      onClose={onClose}
      maxWidth="4xl"
      scrollable
    >
      {showSpinner && (
        <div className="flex flex-col items-center gap-3 text-gray-500 py-12">
          <div className="flex items-center gap-2">
            <Spinner />
            <span>Generating summary...</span>
          </div>
          {cancelButton}
        </div>
      )}
      {response.length > 0 && (
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
      {isLoading && response.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
          <Spinner />
          <span>Streaming…</span>
          {cancelButton}
        </div>
      )}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Sorry, an error occurred: {error}
        </div>
      )}
    </Dialog>
  )
}
