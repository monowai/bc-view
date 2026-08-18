import React, { useCallback, useMemo, useState } from "react"
import useSwr, { mutate } from "swr"
import { usePermissions } from "@hooks/usePermissions"
import {
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import {
  Asset,
  AssetCategory,
  Market,
  Transaction,
  TrnType,
} from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { buildRatioSeries } from "@utils/chart/ratioSeries"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { FormatValue } from "@components/ui/MoneyUtils"

interface PriceChartPopupProps {
  asset: Asset
  currencySymbol?: string
  portfolioId?: string
  // Aggregated holdings drill-down: an asset held across several portfolios.
  // Takes precedence over portfolioId; trades are fetched for the union.
  portfolios?: string[]
  // Optional limit/target price to compare against the latest market close.
  // When set, a horizontal reference line is drawn and the header reports the
  // gap between market and limit — used by the proposed-trade review to sanity
  // check a limit price against current market.
  limitPrice?: number
  limitLabel?: string
  onClose: () => void
}

interface PricePoint {
  priceDate: string
  close: number
  open?: number
  high?: number
  low?: number
  previousClose?: number
  change?: number
  changePercent?: number
  volume?: number
  split?: number | string
  dividend?: number | string
}

interface ResolvedAsset {
  id: string
  code: string
  name?: string
  market: Market
  assetCategory?: AssetCategory
}

interface PriceHistoryResponse {
  asset: ResolvedAsset
  prices: PricePoint[]
}

interface ChartPoint {
  priceDate: string
  close: number
  closeRaw: number
  splitFactor: number
  split?: number
  sma?: number
  ratio?: number
  buyPrice?: number | null
  sellPrice?: number | null
  buyPriceRaw?: number
  sellPriceRaw?: number
  buyQty?: number
  sellQty?: number
}

const RANGES: { label: string; months: number }[] = [
  { label: "1m", months: 1 },
  { label: "3m", months: 3 },
  { label: "6m", months: 6 },
  { label: "12m", months: 12 },
  { label: "24m", months: 24 },
  { label: "5y", months: 60 },
  { label: "10y", months: 120 },
]

const SMA_OPTIONS: { label: string; window: number }[] = [
  { label: "Off", window: 0 },
  { label: "SMA 20", window: 20 },
  { label: "SMA 50", window: 50 },
]

// A ratio overlay divides one price series by another and plots the result,
// rebased to 100, on the right-hand axis. `SELF` means "the asset being
// charted", so a relative-strength line costs no extra numerator fetch.
interface OverlayOption {
  label: string
  numerator: string | null
  denominator: string | null
  hint?: string
}

const SELF = "SELF"

const OVERLAYS: OverlayOption[] = [
  { label: "None", numerator: null, denominator: null },
  {
    label: "RSP/SPY",
    numerator: "US:RSP",
    denominator: "US:SPY",
    hint: "Equal-weight vs cap-weight S&P 500 — rising means breadth is widening",
  },
  {
    label: "vs SPY",
    numerator: SELF,
    denominator: "US:SPY",
    hint: "This asset's relative strength against the S&P 500",
  },
]

function pickDefault<T extends number>(
  raw: string | undefined,
  allowed: T[],
  fallback: T,
): T {
  const n = Number(raw)
  return Number.isFinite(n) && (allowed as number[]).includes(n)
    ? (n as T)
    : fallback
}

const DEFAULT_MONTHS = pickDefault(
  process.env.NEXT_PUBLIC_CHART_DEFAULT_MONTHS,
  RANGES.map((r) => r.months),
  6,
)
const DEFAULT_SMA = pickDefault(
  process.env.NEXT_PUBLIC_CHART_DEFAULT_SMA,
  SMA_OPTIONS.map((s) => s.window),
  20,
)
// Off by default: the overlay costs two more asset lookups plus two price
// histories, and most holdings are opened to read price, not breadth.
const DEFAULT_OVERLAY =
  OVERLAYS.find(
    (o) => o.label === process.env.NEXT_PUBLIC_CHART_DEFAULT_OVERLAY,
  )?.label ?? OVERLAYS[0].label

function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() - months)
  return d
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatAxisDate(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  if (months <= 3) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
}

function computeSma(values: number[], window: number): (number | undefined)[] {
  if (window <= 1 || values.length === 0) return values.map(() => undefined)
  const out: (number | undefined)[] = new Array(values.length)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= window) sum -= values[i - window]
    const denom = Math.min(i + 1, window)
    out[i] = sum / denom
  }
  return out
}

/**
 * Price history for one side of a ratio overlay. `spec` is a "MARKET:CODE"
 * ticker; a null spec (overlay off, or the leg is the charted asset itself)
 * parks both requests on a null SWR key so nothing is fetched.
 *
 * svc-data creates the asset on first lookup and backfills its price history
 * on first chart, so RSP/SPY resolve even though nobody holds them. Both
 * requests are keyed by URL, so every popup at the same range shares one fetch.
 */
function useOverlayLeg(
  spec: string | null,
  from: string,
  to: string,
): PricePoint[] | undefined {
  const resolveUrl = spec
    ? `/api/assets/resolve?code=${encodeURIComponent(spec)}`
    : null
  const { data: resolved } = useSwr<{ data: { id: string } }>(
    resolveUrl,
    resolveUrl ? simpleFetcher(resolveUrl) : null,
  )
  const legId = resolved?.data?.id
  const historyUrl = legId
    ? `/api/prices/history/${legId}?from=${from}&to=${to}`
    : null
  const { data } = useSwr<PriceHistoryResponse>(
    historyUrl,
    historyUrl ? simpleFetcher(historyUrl) : null,
  )
  return data?.prices
}

interface TooltipPayload {
  active?: boolean
  payload?: { dataKey: string; value: number; payload: ChartPoint }[]
  currencySymbol: string
  ratioLabel?: string
}

const ChartTooltip: React.FC<TooltipPayload> = ({
  active,
  payload,
  currencySymbol,
  ratioLabel,
}) => {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  const adjusted = point.splitFactor !== 1
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="text-gray-500 mb-1">{point.priceDate}</div>
      <div className="font-semibold text-gray-900 tabular-nums">
        {currencySymbol}
        <FormatValue value={point.close} />
        {adjusted && (
          <span className="ml-1 text-[10px] font-normal text-gray-400">
            adj
          </span>
        )}
      </div>
      {adjusted && (
        <div className="text-[11px] text-gray-400 tabular-nums">
          Raw: {currencySymbol}
          <FormatValue value={point.closeRaw} />
        </div>
      )}
      {point.split && (
        <div className="text-[11px] text-amber-600">Split {point.split}:1</div>
      )}
      {typeof point.sma === "number" && (
        <div className="text-xs text-indigo-600 tabular-nums">
          SMA: {currencySymbol}
          <FormatValue value={point.sma} />
        </div>
      )}
      {ratioLabel && typeof point.ratio === "number" && (
        <div className="text-xs text-sky-600 tabular-nums">
          {ratioLabel}: {point.ratio.toFixed(1)}
          <span className="ml-1 text-gray-400">
            ({point.ratio >= 100 ? "+" : ""}
            {(point.ratio - 100).toFixed(1)}% vs range start)
          </span>
        </div>
      )}
      {typeof point.buyPrice === "number" && (
        <div className="text-xs text-blue-600 tabular-nums">
          Buy {point.buyQty} @ {currencySymbol}
          <FormatValue value={point.buyPrice} />
          {point.buyPriceRaw !== point.buyPrice && (
            <span className="ml-1 text-gray-400">
              (raw {currencySymbol}
              <FormatValue value={point.buyPriceRaw ?? 0} />)
            </span>
          )}
        </div>
      )}
      {typeof point.sellPrice === "number" && (
        <div className="text-xs text-red-600 tabular-nums">
          Sell {point.sellQty} @ {currencySymbol}
          <FormatValue value={point.sellPrice} />
          {point.sellPriceRaw !== point.sellPrice && (
            <span className="ml-1 text-gray-400">
              (raw {currencySymbol}
              <FormatValue value={point.sellPriceRaw ?? 0} />)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

const TradeDot: React.FC<{
  cx?: number
  cy?: number
  color: string
  direction: "up" | "down"
}> = ({ cx, cy, color, direction }) => {
  if (cx == null || cy == null) return null
  const path =
    direction === "up"
      ? `M${cx},${cy - 6} L${cx - 5},${cy + 4} L${cx + 5},${cy + 4} Z`
      : `M${cx},${cy + 6} L${cx - 5},${cy - 4} L${cx + 5},${cy - 4} Z`
  return <path d={path} fill={color} stroke="#fff" strokeWidth={1} />
}

const PriceChartPopup: React.FC<PriceChartPopupProps> = ({
  asset,
  currencySymbol = "",
  portfolioId,
  portfolios,
  limitPrice,
  limitLabel = "Limit",
  onClose,
}) => {
  const [months, setMonths] = useState(DEFAULT_MONTHS)
  const [smaWindow, setSmaWindow] = useState(DEFAULT_SMA)
  const [overlayLabel, setOverlayLabel] = useState(DEFAULT_OVERLAY)
  const { admin: isAdmin } = usePermissions()
  const [repairState, setRepairState] = useState<{
    busy: boolean
    message: string | null
    error: boolean
  }>({ busy: false, message: null, error: false })

  const { from, to } = useMemo(() => {
    const today = new Date()
    return {
      from: toIsoDate(subtractMonths(today, months)),
      to: toIsoDate(today),
    }
  }, [months])

  const priceUrl = `/api/prices/history/${asset.id}?from=${from}&to=${to}`
  const {
    data: priceData,
    error: priceError,
    isLoading: pricesLoading,
  } = useSwr<PriceHistoryResponse>(priceUrl, simpleFetcher(priceUrl))

  const overlay = OVERLAYS.find((o) => o.label === overlayLabel) ?? OVERLAYS[0]
  const numeratorLeg = useOverlayLeg(
    overlay.numerator === SELF ? null : overlay.numerator,
    from,
    to,
  )
  const denominatorLeg = useOverlayLeg(overlay.denominator, from, to)
  // A SELF numerator reuses the history already fetched for the price area.
  const ratioNumerator =
    overlay.numerator === SELF ? priceData?.prices : numeratorLeg

  const handleRepairSplits = useCallback(async () => {
    setRepairState({ busy: true, message: null, error: false })
    try {
      const response = await fetch(`/api/prices/${asset.id}/repair-splits`, {
        method: "POST",
      })
      if (!response.ok) {
        const detail =
          response.status === 403
            ? "Admin scope required"
            : `HTTP ${response.status}`
        setRepairState({
          busy: false,
          message: `Repair failed: ${detail}`,
          error: true,
        })
        return
      }
      const body = (await response.json()) as {
        stamped: number
        alreadyStamped: number
        missingRows: number
      }
      setRepairState({
        busy: false,
        message: `Repaired: ${body.stamped} stamped, ${body.alreadyStamped} already, ${body.missingRows} missing`,
        error: false,
      })
      // Force a chart refresh against the now-stamped data.
      await mutate(priceUrl)
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      setRepairState({
        busy: false,
        message: `Repair failed: ${message}`,
        error: true,
      })
    }
  }, [asset.id, priceUrl])

  const tradesUrl =
    portfolios && portfolios.length > 0
      ? `/api/trns/trades/${asset.id}?portfolios=${encodeURIComponent(
          portfolios.join(","),
        )}`
      : portfolioId
        ? `/api/trns/trades/${portfolioId}/${asset.id}`
        : null
  const { data: tradesData } = useSwr<{ data: Transaction[] }>(
    tradesUrl,
    tradesUrl ? simpleFetcher(tradesUrl) : null,
  )

  const tradesByDate = useMemo(() => {
    const map = new Map<
      string,
      { type: TrnType; price: number; quantity: number }[]
    >()
    const priceDates = (priceData?.prices ?? []).map((p) => p.priceDate)
    if (priceDates.length === 0) return map
    const raw = tradesData?.data ?? []
    const sortedTrades = raw
      .filter(
        (trn): trn is Transaction =>
          (trn.trnType === "BUY" || trn.trnType === "SELL") &&
          !!trn.tradeDate &&
          trn.tradeDate >= from &&
          trn.tradeDate <= to,
      )
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
    let cursor = 0
    for (const trn of sortedTrades) {
      while (cursor < priceDates.length && priceDates[cursor] < trn.tradeDate) {
        cursor++
      }
      const anchor =
        cursor < priceDates.length
          ? priceDates[cursor]
          : priceDates[priceDates.length - 1]
      const list = map.get(anchor) ?? []
      list.push({
        type: trn.trnType,
        price: Number(trn.price),
        quantity: Number(trn.quantity),
      })
      map.set(anchor, list)
    }
    return map
  }, [tradesData, priceData, from, to])

  const series: ChartPoint[] = useMemo(() => {
    const raw = priceData?.prices ?? []
    // svc-data's PriceService returns split-adjusted prices and normalises the
    // `split` column so only the canonical ex-date row carries a non-1 value.
    // The chart renders the response as-is.
    const closes = raw.map((p) => Number(p.close))
    const smaSeries = computeSma(closes, smaWindow)
    const ratioSeries = buildRatioSeries(
      raw.map((p) => p.priceDate),
      ratioNumerator ?? [],
      denominatorLeg ?? [],
    )
    return raw.map((p, i) => {
      const trades = tradesByDate.get(p.priceDate) ?? []
      const buy = trades.find((t) => t.type === "BUY")
      const sell = trades.find((t) => t.type === "SELL")
      const splitNum = Number(p.split ?? 1)
      return {
        priceDate: p.priceDate,
        close: closes[i],
        closeRaw: closes[i],
        splitFactor: 1,
        split: splitNum !== 1 ? splitNum : undefined,
        sma: smaSeries[i],
        ratio: ratioSeries[i],
        buyPrice: buy ? buy.price : null,
        sellPrice: sell ? sell.price : null,
        buyPriceRaw: buy?.price,
        sellPriceRaw: sell?.price,
        buyQty: buy?.quantity,
        sellQty: sell?.quantity,
      }
    })
  }, [priceData, tradesByDate, smaWindow, ratioNumerator, denominatorLeg])

  const resolvedName = priceData?.asset?.name ?? asset.name
  const resolvedMarket = priceData?.asset?.market?.code ?? asset.market?.code

  const { min, max } = useMemo(() => {
    if (series.length === 0) return { min: 0, max: 0 }
    const vals: number[] = []
    for (const p of series) {
      vals.push(p.close)
      if (typeof p.sma === "number") vals.push(p.sma)
      if (typeof p.buyPrice === "number") vals.push(p.buyPrice)
      if (typeof p.sellPrice === "number") vals.push(p.sellPrice)
    }
    // Keep the limit line inside the plotted range so it never clips off-axis.
    if (typeof limitPrice === "number") vals.push(limitPrice)
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [series, limitPrice])

  const yDomain = useMemo<[number, number]>(() => {
    if (series.length === 0) return [0, 1]
    const span = max - min || max * 0.02 || 1
    return [min - span * 0.1, max + span * 0.1]
  }, [series.length, min, max])

  const last = series[series.length - 1]
  const first = series[0]
  const changePct =
    first && last && first.close !== 0
      ? ((last.close - first.close) / first.close) * 100
      : 0
  const positive = changePct >= 0

  // Gap of the latest market close over the supplied limit. Positive means the
  // market trades above the limit (a buy limit would not fill; a sell limit
  // would). null until we have both a close and a non-zero limit.
  const limitGapPct =
    typeof limitPrice === "number" && limitPrice !== 0 && last
      ? ((last.close - limitPrice) / limitPrice) * 100
      : null

  const splitEvents = useMemo(
    () => series.filter((p) => typeof p.split === "number"),
    [series],
  )

  // Only claim the right-hand axis once the overlay actually has data — a
  // selected-but-still-loading overlay would otherwise render an empty axis.
  const ratioActive = series.some((p) => typeof p.ratio === "number")
  const ratioLast = [...series]
    .reverse()
    .find((p) => typeof p.ratio === "number")?.ratio

  return (
    <Dialog
      title={
        <div>
          <div>{resolvedName || asset.code}</div>
          <p className="text-sm text-gray-500 font-normal">
            {resolvedMarket}:{asset.code}
          </p>
        </div>
      }
      onClose={onClose}
      maxWidth="3xl"
      scrollable
      footer={
        <div className="flex items-center gap-3 w-full justify-between">
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-2 rounded hover:bg-amber-200 disabled:opacity-50 transition-colors text-sm"
                onClick={handleRepairSplits}
                disabled={repairState.busy}
                title="Stamp split factors on this asset's price history (admin only)"
              >
                {repairState.busy ? "Repairing…" : "Repair splits"}
              </button>
            )}
            {repairState.message && (
              <span
                className={`text-xs ${
                  repairState.error ? "text-red-600" : "text-emerald-700"
                }`}
                role="status"
              >
                {repairState.message}
              </span>
            )}
          </div>
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {"Close"}
          </button>
        </div>
      }
    >
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setMonths(r.months)}
                className={`px-3 py-1 rounded text-xs font-medium tracking-wide transition-colors ${
                  months === r.months
                    ? "bg-wealth-600 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-gray-200" aria-hidden />
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 mr-1">SMA:</span>
            {SMA_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setSmaWindow(opt.window)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  smaWindow === opt.window
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="h-4 w-px bg-gray-200" aria-hidden />
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 mr-1">Ratio:</span>
            {OVERLAYS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => setOverlayLabel(opt.label)}
                title={opt.hint}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  overlayLabel === opt.label
                    ? "bg-sky-600 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {last && (
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900 tabular-nums">
              {currencySymbol}
              <FormatValue value={last.close} />
            </div>
            <div
              className={`text-xs tabular-nums ${
                positive ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {positive ? "+" : ""}
              {changePct.toFixed(2)}%
            </div>
            {typeof limitPrice === "number" && (
              <div className="mt-1 text-xs tabular-nums">
                <span className="text-gray-500">{limitLabel} </span>
                <span className="font-medium text-gray-700">
                  {currencySymbol}
                  {limitPrice.toFixed(2)}
                </span>
                {limitGapPct !== null && (
                  <span
                    className={`ml-1 ${
                      limitGapPct >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {limitGapPct >= 0 ? "+" : ""}
                    {limitGapPct.toFixed(2)}% vs limit
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3 text-xs gap-3 text-gray-500">
        <span>
          {ratioActive && (
            <span className="flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block w-4 h-0.5 bg-sky-500 rounded"
              />
              <span className="text-sky-700">{overlay.label}</span>
              {typeof ratioLast === "number" && (
                <span className="tabular-nums">
                  {ratioLast >= 100 ? "+" : ""}
                  {(ratioLast - 100).toFixed(1)}% over range
                </span>
              )}
              {overlay.hint && (
                <span className="text-gray-400">— {overlay.hint}</span>
              )}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-blue-600"
            />
            Buy
          </span>
          <span className="flex items-center gap-1">
            <span
              aria-hidden
              className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-red-600"
            />
            Sell
          </span>
        </span>
      </div>

      <div className="h-80">
        {pricesLoading && (
          <div className="flex items-center justify-center h-full">
            <Spinner label={"Loading..."} />
          </div>
        )}
        {priceError && !pricesLoading && (
          <div className="flex items-center justify-center h-full text-red-500 text-sm">
            {"Failed to load price history"}
          </div>
        )}
        {!pricesLoading && !priceError && series.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {"No price history available for this period"}
          </div>
        )}
        {!pricesLoading && !priceError && series.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={positive ? "#10B981" : "#EF4444"}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor={positive ? "#10B981" : "#EF4444"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="priceDate"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
                minTickGap={32}
                tickFormatter={(v) => formatAxisDate(v, months)}
              />
              <YAxis
                yAxisId="price"
                domain={yDomain}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
                width={64}
                tickFormatter={(v: number) =>
                  `${currencySymbol}${v.toFixed(2)}`
                }
              />
              {ratioActive && (
                <YAxis
                  yAxisId="ratio"
                  orientation="right"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fontSize: 10, fill: "#0284C7" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E5E7EB" }}
                  width={44}
                  tickFormatter={(v: number) => v.toFixed(0)}
                />
              )}
              <Tooltip
                content={
                  <ChartTooltip
                    currencySymbol={currencySymbol}
                    ratioLabel={ratioActive ? overlay.label : undefined}
                  />
                }
              />
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="close"
                stroke={positive ? "#10B981" : "#EF4444"}
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive={false}
              />
              {typeof limitPrice === "number" && (
                <ReferenceLine
                  yAxisId="price"
                  y={limitPrice}
                  stroke="#7C3AED"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `${limitLabel} ${currencySymbol}${limitPrice.toFixed(2)}`,
                    position: "insideTopLeft",
                    fontSize: 10,
                    fill: "#6D28D9",
                  }}
                />
              )}
              {splitEvents.map((p) => (
                <ReferenceLine
                  key={`split-${p.priceDate}`}
                  yAxisId="price"
                  x={p.priceDate}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: `${p.split}:1`,
                    position: "top",
                    fontSize: 10,
                    fill: "#B45309",
                  }}
                />
              ))}
              {smaWindow > 0 && (
                <Line
                  key={`sma-${smaWindow}`}
                  yAxisId="price"
                  type="monotone"
                  dataKey="sma"
                  stroke="#6366F1"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  connectNulls
                />
              )}
              {ratioActive && (
                <Line
                  key={`ratio-${overlay.label}`}
                  yAxisId="ratio"
                  type="monotone"
                  dataKey="ratio"
                  stroke="#0EA5E9"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  connectNulls
                />
              )}
              <Scatter
                yAxisId="price"
                dataKey="buyPrice"
                fill="#2563EB"
                shape={<TradeDot color="#2563EB" direction="up" />}
                isAnimationActive={false}
              />
              <Scatter
                yAxisId="price"
                dataKey="sellPrice"
                fill="#EF4444"
                shape={<TradeDot color="#EF4444" direction="down" />}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Dialog>
  )
}

export default PriceChartPopup
