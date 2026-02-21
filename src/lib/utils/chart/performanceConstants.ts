/**
 * Shared constants and formatters for performance charts.
 * Used by both per-portfolio PerformanceChart and aggregated WealthPerformanceChart.
 */

export const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 120 },
]

// Recharts requires inline style values — centralise them here for maintainability
export const CHART_COLORS = {
  accent: "#10b981", // emerald-500
  axis: "#9ca3af", // gray-400
  tooltipBg: "rgba(15, 23, 42, 0.95)", // slate-900 @ 95%
  tooltipText: "#e2e8f0", // slate-200
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

export const AXIS_TICK = {
  fontSize: 10,
  fill: CHART_COLORS.axis,
  fontFamily: "var(--font-jetbrains-mono)",
}

export const ACTIVE_DOT = {
  r: 4,
  fill: CHART_COLORS.accent,
  stroke: "#fff",
  strokeWidth: 2,
}

export const TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.tooltipBg,
  border: "none",
  borderRadius: "6px",
  padding: "8px 12px",
  color: CHART_COLORS.tooltipText,
  fontSize: "12px",
  fontFamily: "var(--font-jetbrains-mono), monospace",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
}

export function formatCompact(value: number, sym: string): string {
  if (Math.abs(value) >= 1_000_000)
    return `${sym}${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}K`
  return `${sym}${value.toFixed(0)}`
}

export function formatFull(value: number, sym: string): string {
  return `${sym}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatAxisDate(date: string): string {
  const d = new Date(date)
  return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
}

export function formatTooltipDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
