import React, { useMemo } from "react"
import AnalysisDialog from "@components/features/chat/AnalysisDialog"
import { AnalysisRequest } from "@components/features/chat/useAnalysisChat"

export type PortfolioReviewTarget =
  | { kind: "portfolio"; id: string; code: string; name: string }
  | { kind: "aggregated"; codes: string[] }

interface PortfolioReviewPopupProps {
  target: PortfolioReviewTarget
  onClose: () => void
}

const CACHE_TTL_MS = 30 * 60 * 1000

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

function buildRequest(target: PortfolioReviewTarget): AnalysisRequest {
  const common = {
    cacheKey: `portfolio-review|${targetKey(target)}`,
    // Blank: svc-agent asks its canned daily-briefing question for this page.
    query: "",
    label: `AI Summary — ${targetTitle(target)}`,
    ttlMs: CACHE_TTL_MS,
  }
  if (target.kind === "portfolio") {
    return {
      ...common,
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
    ...common,
    context: {
      page: "Portfolio Review",
      description:
        "AI Summary popup for aggregated holdings across portfolios (daily-read).",
      portfolioCodes: target.codes,
    },
  }
}

export default function PortfolioReviewPopup({
  target,
  onClose,
}: PortfolioReviewPopupProps): React.ReactElement {
  const request = useMemo(() => buildRequest(target), [target])
  return (
    <AnalysisDialog
      title={
        <span className="flex items-center">
          <i className="fas fa-robot text-blue-500 mr-2"></i>
          AI Summary — {targetTitle(target)}
        </span>
      }
      request={request}
      loadingLabel="Generating summary..."
      onClose={onClose}
    />
  )
}
