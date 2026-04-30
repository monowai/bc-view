import React, { useEffect, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Spinner from "@components/ui/Spinner"
import { AgentResponse } from "types/agent"
import { HoldingContract, Portfolio, Position } from "types/beancounter"

interface PortfolioAIOverviewProps {
  portfolio: Portfolio
}

interface TopHolding {
  code: string
  name?: string
  market?: string
  sector?: string
  marketValue: number
  weight: number
  gainOnDayPercent: number | null
}

const MAX_MOVERS_PER_SIDE = 5
const CACHE_TTL_MS = 15 * 60 * 1000

const overviewCache = new Map<string, { response: string; fetchedAt: number }>()
const inFlight = new Map<string, Promise<string>>()

export function clearOverviewCache(): void {
  overviewCache.clear()
  inFlight.clear()
}

const cacheKey = (code: string, asAt: string): string => `${code}|${asAt}`

function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function safePct(numerator: number, denominator: number): number | null {
  if (!denominator) return null
  return (numerator / denominator) * 100
}

interface BiggestMovers {
  gainers: TopHolding[]
  losers: TopHolding[]
}

function buildBiggestMovers(holdings: HoldingContract | null): BiggestMovers {
  if (!holdings?.positions) return { gainers: [], losers: [] }
  // The svc-position contract returns positions as a Record keyed by
  // owner.asset:bucket — flatten to Position[] before ranking.
  const positions: Position[] = Object.values(holdings.positions)
  const movers = positions
    .map<TopHolding>((p) => {
      const marketValue = p.moneyValues?.PORTFOLIO?.marketValue ?? 0
      const gainOnDay = p.moneyValues?.PORTFOLIO?.gainOnDay ?? 0
      return {
        code: p.asset.code,
        name: p.asset.name,
        market: p.asset.market?.code,
        sector: p.asset.sector,
        marketValue,
        weight: p.moneyValues?.PORTFOLIO?.weight ?? 0,
        gainOnDayPercent: safePct(gainOnDay, marketValue - gainOnDay),
      }
    })
    .filter(
      (h): h is TopHolding & { gainOnDayPercent: number } =>
        h.marketValue > 0 && h.gainOnDayPercent !== null,
    )

  const gainers = [...movers]
    .filter((h) => h.gainOnDayPercent > 0)
    .sort((a, b) => b.gainOnDayPercent - a.gainOnDayPercent)
    .slice(0, MAX_MOVERS_PER_SIDE)

  const losers = [...movers]
    .filter((h) => h.gainOnDayPercent < 0)
    .sort((a, b) => a.gainOnDayPercent - b.gainOnDayPercent)
    .slice(0, MAX_MOVERS_PER_SIDE)

  return { gainers, losers }
}

function formatHolding(h: TopHolding, i: number): string {
  const marketLabel = h.market ? `.${h.market}` : ""
  const sectorLabel = h.sector ? ` [${h.sector}]` : ""
  const dayLabel =
    h.gainOnDayPercent !== null ? `, day ${h.gainOnDayPercent.toFixed(2)}%` : ""
  return (
    `${i + 1}. ${h.code}${marketLabel}${sectorLabel}` +
    ` — weight ${(h.weight * 100).toFixed(1)}%${dayLabel}` +
    (h.name ? ` (${h.name})` : "")
  )
}

function buildQuery(portfolio: Portfolio, movers: BiggestMovers): string {
  const lines: string[] = []
  lines.push(
    `Provide an AI overview for portfolio ${portfolio.code} (${portfolio.name}).`,
  )
  lines.push(
    `Base currency: ${portfolio.base.code}. Reporting currency: ${portfolio.currency.code}.`,
  )
  if (portfolio.irr !== undefined && portfolio.irr !== null) {
    lines.push(`Overall IRR: ${(portfolio.irr * 100).toFixed(2)}%.`)
  }
  if (portfolio.marketValue) {
    lines.push(
      `Market value: ${portfolio.base.code} ${portfolio.marketValue.toFixed(2)}.`,
    )
  }
  if (portfolio.gainOnDay) {
    const prev = portfolio.marketValue - portfolio.gainOnDay
    const pct = safePct(portfolio.gainOnDay, prev)
    lines.push(
      `Day change: ${portfolio.gainOnDay.toFixed(2)} ${portfolio.base.code}` +
        (pct !== null ? ` (${pct.toFixed(2)}%)` : "") +
        ".",
    )
  }
  if (movers.gainers.length) {
    lines.push(`Top gainers today (by % move):`)
    movers.gainers.forEach((h, i) => lines.push(formatHolding(h, i)))
  }
  if (movers.losers.length) {
    lines.push(`Top losers today (by % move):`)
    movers.losers.forEach((h, i) => lines.push(formatHolding(h, i)))
  }
  if (!movers.gainers.length && !movers.losers.length) {
    lines.push("(No daily price moves available for the current holdings.)")
  }
  lines.push(
    "Focus on news and corporate events driving today's biggest movers above " +
      "(both gainers and losers). For each named mover, surface the specific " +
      "story or event that explains the move where possible. Then briefly note " +
      "any macro-economic factors (rates, inflation, FX, geopolitical) that " +
      "tie the movers together. Where live news is unavailable for a ticker, " +
      "label that section as general knowledge rather than live news. Use " +
      "concise markdown with one heading per mover.",
  )
  return lines.join("\n")
}

async function fetchHoldings(
  portfolioId: string,
  asAt: string,
): Promise<HoldingContract | null> {
  try {
    // Use the id-based route so the AI Overview also works for managed
    // (shared) portfolios — code is unique only within an owner.
    const res = await fetch(
      `/api/holdings/id/${encodeURIComponent(portfolioId)}?asAt=${asAt}`,
    )
    if (!res.ok) return null
    // svc-position wraps the contract in `{ data: HoldingContract }`.
    const body = (await res.json()) as { data?: HoldingContract }
    return body.data ?? null
  } catch {
    return null
  }
}

async function performFetch(
  key: string,
  portfolio: Portfolio,
  asAt: string,
): Promise<string> {
  const holdings = await fetchHoldings(portfolio.id, asAt)
  const movers = buildBiggestMovers(holdings)
  const query = buildQuery(portfolio, movers)

  const res = await fetch("/api/agent/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      context: {
        page: "Portfolio AI Overview",
        description:
          "News and events behind today's biggest gainers and losers in the portfolio.",
        portfolioCode: portfolio.code,
        portfolioName: portfolio.name,
        baseCurrency: portfolio.base.code,
        reportingCurrency: portfolio.currency.code,
        asAt,
        topGainers: movers.gainers,
        topLosers: movers.losers,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const data: AgentResponse = await res.json()
  overviewCache.set(key, { response: data.response, fetchedAt: Date.now() })
  return data.response
}

function fetchOverviewOnce(
  key: string,
  portfolio: Portfolio,
  asAt: string,
): Promise<string> {
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = performFetch(key, portfolio, asAt).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, promise)
  return promise
}

export default function PortfolioAIOverview({
  portfolio,
}: PortfolioAIOverviewProps): React.ReactElement {
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const asAt = todayIso()
    const key = cacheKey(portfolio.code, asAt)
    const cached = overviewCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setResponse(cached.response)
      setIsLoading(false)
      return () => {}
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setResponse(null)
    fetchOverviewOnce(key, portfolio, asAt)
      .then((text) => {
        if (!cancelled) setResponse(text)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to fetch AI overview",
          )
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [portfolio])

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
      <div className="flex items-center text-sm font-semibold text-slate-700 mb-2">
        <i className="fas fa-wand-magic-sparkles text-purple-600 mr-2"></i>
        AI Overview — {portfolio.code}
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-gray-500 py-4">
          <Spinner />
          <span>Analysing portfolio…</span>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          Sorry, an error occurred: {error}
        </div>
      )}
      {response && (
        <div
          className="prose prose-sm max-w-none
            prose-headings:text-slate-900 prose-headings:font-semibold
            prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
            prose-h2:mt-4 prose-h2:mb-2 prose-h3:mt-3 prose-h3:mb-1
            prose-p:text-slate-700 prose-p:leading-relaxed
            prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-slate-900
            prose-ul:my-2 prose-li:my-0.5
            prose-table:text-sm"
        >
          <Markdown remarkPlugins={[remarkGfm]}>{response}</Markdown>
        </div>
      )}
    </div>
  )
}
