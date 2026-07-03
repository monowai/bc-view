import React, { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { AssetWeightWithDetails } from "types/rebalance"

interface AssetInsightPopupProps {
  asset: AssetWeightWithDetails
  modelName: string
  onClose: () => void
}

const ASSET_INSIGHT_PROMPT = `Role: You are a concise financial analyst reviewing individual assets for inclusion in a model portfolio.

For the given asset, provide a brief investment analysis (150-250 words) covering:
1. Investment thesis: Why this asset belongs in the model
2. Key characteristics: What it provides (exposure, diversification, income, etc.)
3. Key risks: Main risks to monitor
4. Fit for model: How this weight/allocation makes sense in context

Style: Clear, direct, evidence-based. No buy/sell recommendations. No filler.`

const insightCache = new Map<string, { response: string; fetchedAt: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

export function clearAssetInsightCache(): void {
  insightCache.clear()
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

export default function AssetInsightPopup({
  asset,
  modelName,
  onClose,
}: AssetInsightPopupProps): React.ReactElement {
  const [response, setResponse] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const cacheKey = `${asset.assetCode || asset.assetId}|${modelName}`

  const cancel = (): void => {
    abortRef.current?.abort()
    setIsLoading(false)
  }

  useEffect(() => {
    const cached = insightCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      let accumulated = ""
      let streamError: string | null = null
      try {
        const res = await fetch("/api/agent/query/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            query: ASSET_INSIGHT_PROMPT,
            context: {
              page: "Model Asset Insight",
              description:
                "AI analysis of a single asset for a rebalance model portfolio",
              assetCode: asset.assetCode || asset.assetId,
              assetName: asset.assetName,
              targetWeight: `${asset.weight}%`,
              modelName,
            },
          }),
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`)
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""

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
            try {
              const parsed = JSON.parse(data) as { code?: string }
              streamError = parsed.code || data || "stream-error"
            } catch {
              streamError = data || "stream-error"
            }
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
          return crlf < lf ? { index: crlf, len: 4 } : { index: lf, len: 2 }
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
          insightCache.set(cacheKey, {
            response: accumulated,
            fetchedAt: Date.now(),
          })
        }
      } catch (e: unknown) {
        if (controller.signal.aborted) return
        setError(e instanceof Error ? e.message : "Failed to fetch insight")
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void run()

    return () => {
      controller.abort()
    }
  }, [cacheKey, asset, modelName])

  const showSpinner = isLoading && response.length === 0

  const cancelButton = isLoading ? (
    <button
      type="button"
      onClick={cancel}
      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 ring-1 ring-slate-200"
      aria-label="Cancel insight generation"
      title="Cancel"
    >
      <i className="fas fa-stop text-[10px] mr-1"></i>
      Cancel
    </button>
  ) : null

  const displayCode = asset.assetCode || asset.assetId

  return (
    <Dialog
      title={
        <span className="flex items-center">
          <i className="fas fa-robot text-blue-500 mr-2"></i>
          {displayCode}
          {asset.assetName && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              — {asset.assetName}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      maxWidth="4xl"
      scrollable
    >
      {showSpinner && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-gray-500 py-12"
        >
          <div className="flex items-center gap-2">
            <Spinner />
            <span>Generating insight...</span>
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
      <Dialog.ErrorAlert
        message={error ? `Sorry, an error occurred: ${error}` : null}
      />
    </Dialog>
  )
}
