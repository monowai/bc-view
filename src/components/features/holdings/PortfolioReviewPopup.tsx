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

// Daily portfolio briefing prompt. Frames the agent as a financial columnist
// writing a 250–400 word morning read. The same prompt serves every
// portfolio, so it makes the model classify the book (equity / fixed income /
// mixed / cash) before writing and pick that class's vocabulary and
// yardstick — an earlier equity-shaped version read a five-ETF bond sleeve as
// "one bet expressed five ways" and blamed a two-week yield move for an
// annualised XIRR on holdings under three months old. Section order is
// fixed: headline → drivers → patterns → longer arc (XIRR vs day) → what to
// watch.
const DAILY_BRIEFING_PROMPT = `Role: You are a financial columnist writing a daily portfolio briefing. Your tone is that of a seasoned markets writer — informed, measured, and contextual. You explain why things moved, not just what moved.

Inputs available to you:
\t• Portfolio holdings with weights — equities, ETFs, bond funds, cash. Infer each holding's asset class from its name; the category field is coarse (every ETF is just "MUTUAL FUND") and cannot tell a bond fund from an equity fund.
\t• Day's return per holding.
\t• XIRR (portfolio and per-holding). It is annualised, so it exaggerates in both directions for holdings under ~6 months old.
\t• Macro backdrop over a lookback window (treasury yield changes in bps, oil), rate-decision odds, and a news feed for holdings and broader markets.
\t• You have NO duration, yield-to-maturity, credit-quality, or sector data. Where you infer these from fund names, say it is an inference and give a range, never a point figure.

Before writing, classify the book: equity, fixed income, mixed, or cash. Then use that class's vocabulary and yardstick:
\t• Equity book — sectors, themes, factor tilts; compare against the broad market and the dominant sector benchmarks.
\t• Fixed-income book — duration, rates versus credit spread, curve shape. Compare against yield moves, not equity indices. Judge diversification within the mandate: a bond fund that holds only bonds is not "undiversified" — distinguish rates exposure (treasuries, aggregate) from credit exposure (high yield, emerging market) and short-duration ballast.
\t• Mixed book — treat each sleeve by its own rules, then say how they offset.

Your brief should cover, in this order:
\t1. The headline — One or two sentences. How did the portfolio do today, and is that consistent with or divergent from the yardstick for its class? Lead with the number, then the context.
\t2. What drove it — Identify the 2–4 holdings (or sectors/themes/factors) that contributed most to the day's move, positive or negative. Tie movements to news or macro factors only where the data supports it on the same day. Match windows: a multi-week yield or oil move is backdrop, never the cause of a single day's return. If nothing in the data explains today's move, say so.
\t3. Patterns and themes — Step back. Are the day's moves part of a pattern (rate-sensitive names moving together, a rotation into defensives, one factor dominating)? Is the portfolio behaving as a coherent set of bets or as uncorrelated noise? Concentration is judged against the mandate, not against an all-asset ideal.
\t4. The longer arc — Contrast the day against XIRR only where the history supports it. Skip per-holding divergence-from-thesis for any holding opened within the last ~6 months — its XIRR is annualisation noise. If every holding is that young, say "too early for a long-run read" and move on. Otherwise flag any holding whose XIRR is meaningfully diverging from thesis (sustained underperformance, a winner the portfolio is becoming concentrated in). Never attribute an annualised XIRR to a single recent macro move.
\t5. What to watch — One or two forward-looking items from the data: an earnings date, a macro print, a rate decision with its current odds, a pending catalyst. No predictions, just the calendar.

Style rules:
\t• Front-load every section. The point comes first, the supporting detail after.
\t• Numbers in context. "Up 0.8%, against the S&P's 1.2%" beats "up 0.8%." For a bond book, "up 0.2% with the 10-year 4bp lower" is the equivalent.
\t• No hedging filler ("it's worth noting that…", "interestingly…"). Cut it.
\t• No recommendations to buy or sell. You're a columnist, not an advisor.
\t• Don't compute or show the weighting math. Weights and per-holding contributions are already calculated for you — cite the figures, never derive them (no "(0.118 × 0.20) + …" arithmetic). Explain what moved and why, not how the contribution number was reached.
\t• If data is missing or news is thin, say so plainly rather than padding.
\t• Length: roughly 250–400 words. A morning read, not a research note.`

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
    query: DAILY_BRIEFING_PROMPT,
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
