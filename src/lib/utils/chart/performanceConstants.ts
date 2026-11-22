import { GRAY, INVEST, WEALTH } from "@lib/chartPalette"
/**
 * Shared constants and formatters for performance charts.
 * Used by both per-portfolio PerformanceChart and aggregated WealthPerformanceChart.
 */

import type { ReferenceLineProps, XAxisProps, YAxisProps } from "recharts"

export const TIME_RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "2Y", months: 24 },
  { label: "ALL", months: 120 },
]

// Recharts requires inline style values — centralise them here for maintainability
export const CHART_COLORS = {
  accent: INVEST[500], // primary portfolio series
  benchmark: WEALTH[600], // benchmark/index overlay
  axis: GRAY[500], // axis ticks are text: never lighter than gray-500
  tooltipBg: "rgba(17, 24, 39, 0.95)", // gray-900 @ 95%
  tooltipText: GRAY[200],
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

export const DATE_AXIS_PROPS: XAxisProps = {
  dataKey: "date",
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
  tickFormatter: formatAxisDate,
  interval: "preserveStartEnd",
  dy: 4,
}

export const VALUE_AXIS_PROPS: YAxisProps = {
  domain: ["auto", "auto"],
  axisLine: false,
  tickLine: false,
  tick: AXIS_TICK,
  width: 55,
}

export function referenceLineProps(
  y: number,
  label: string,
): ReferenceLineProps {
  return {
    y,
    stroke: CHART_COLORS.axis,
    strokeDasharray: "2 4",
    label: {
      value: label,
      position: "insideTopLeft",
      fill: CHART_COLORS.axis,
      fontSize: 10,
      fontFamily: "var(--font-dm-sans)",
    },
  }
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
