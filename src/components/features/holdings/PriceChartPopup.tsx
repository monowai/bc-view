import React, { useMemo, useState } from "react"
import useSwr from "swr"
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
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { FormatValue } from "@components/ui/MoneyUtils"

interface PriceChartPopupProps {
  asset: Asset
  currencySymbol?: string
  portfolioId: string
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
]

const SMA_OPTIONS: { label: string; window: number }[] = [
  { label: "Off", window: 0 },
  { label: "SMA 20", window: 20 },
  { label: "SMA 50", window: 50 },
]

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

interface TooltipPayload {
  active?: boolean
  payload?: { dataKey: string; value: number; payload: ChartPoint }[]
  currencySymbol: string
}

const ChartTooltip: React.FC<TooltipPayload> = ({
  active,
  payload,
  currencySymbol,
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
        <div className="text-[11px] text-amber-600">
          Split {point.split}:1
        </div>
      )}
      {typeof point.sma === "number" && (
        <div className="text-xs text-indigo-600 tabular-nums">
          SMA: {currencySymbol}
          <FormatValue value={point.sma} />
        </div>
      )}
      {typeof point.buyPrice === "number" && (
        <div className="text-xs text-emerald-600 tabular-nums">
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
  onClose,
}) => {
  const [months, setMonths] = useState(1)
  const [smaWindow, setSmaWindow] = useState(0)

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

  const tradesUrl = `/api/trns/trades/${portfolioId}/${asset.id}`
  const { data: tradesData } = useSwr<{ data: Transaction[] }>(
    tradesUrl,
    simpleFetcher(tradesUrl),
  )

  const tradesByDate = useMemo(() => {
    const map = new Map<
      string,
      { type: TrnType; price: number; quantity: number }[]
    >()
    const raw = tradesData?.data ?? []
    for (const trn of raw) {
      if (trn.trnType !== "BUY" && trn.trnType !== "SELL") continue
      if (!trn.tradeDate || trn.tradeDate < from || trn.tradeDate > to) continue
      const list = map.get(trn.tradeDate) ?? []
      list.push({
        type: trn.trnType,
        price: Number(trn.price),
        quantity: Number(trn.quantity),
      })
      map.set(trn.tradeDate, list)
    }
    return map
  }, [tradesData, from, to])

  const series: ChartPoint[] = useMemo(() => {
    const raw = priceData?.prices ?? []
    // Walk in reverse, accumulating split factors so pre-split rows are
    // scaled onto the current share basis (e.g. 25:1 => /25 before the ex-date).
    const factors = new Array<number>(raw.length).fill(1)
    let cumulative = 1
    for (let i = raw.length - 1; i >= 0; i--) {
      factors[i] = cumulative
      const split = Number(raw[i].split ?? 1)
      if (split && split !== 1) cumulative *= split
    }
    const adjustedCloses = raw.map((p, i) => Number(p.close) / factors[i])
    const smaSeries = computeSma(adjustedCloses, smaWindow)
    return raw.map((p, i) => {
      const trades = tradesByDate.get(p.priceDate) ?? []
      const buy = trades.find((t) => t.type === "BUY")
      const sell = trades.find((t) => t.type === "SELL")
      const splitNum = Number(p.split ?? 1)
      return {
        priceDate: p.priceDate,
        close: adjustedCloses[i],
        closeRaw: Number(p.close),
        splitFactor: factors[i],
        split: splitNum !== 1 ? splitNum : undefined,
        sma: smaSeries[i],
        buyPrice: buy ? buy.price / factors[i] : null,
        sellPrice: sell ? sell.price / factors[i] : null,
        buyPriceRaw: buy?.price,
        sellPriceRaw: sell?.price,
        buyQty: buy?.quantity,
        sellQty: sell?.quantity,
      }
    })
  }, [priceData, tradesByDate, smaWindow])

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
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }, [series])

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

  const splitEvents = useMemo(
    () => series.filter((p) => typeof p.split === "number"),
    [series],
  )

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
        <button
          className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
          onClick={onClose}
        >
          {"Close"}
        </button>
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
          </div>
        )}
      </div>

      <div className="flex items-center justify-end mb-3 text-xs gap-3 text-gray-500">
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent border-b-emerald-600"
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
                domain={yDomain}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#E5E7EB" }}
                width={64}
                tickFormatter={(v: number) =>
                  `${currencySymbol}${v.toFixed(2)}`
                }
              />
              <Tooltip
                content={<ChartTooltip currencySymbol={currencySymbol} />}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={positive ? "#10B981" : "#EF4444"}
                strokeWidth={2}
                fill="url(#priceFill)"
                isAnimationActive={false}
              />
              {splitEvents.map((p) => (
                <ReferenceLine
                  key={`split-${p.priceDate}`}
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
              <Scatter
                dataKey="buyPrice"
                fill="#10B981"
                shape={<TradeDot color="#10B981" direction="up" />}
                isAnimationActive={false}
              />
              <Scatter
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
