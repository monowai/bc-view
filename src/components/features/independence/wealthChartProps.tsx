import React from "react"
import type { XAxisProps, YAxisProps } from "recharts"
import { Area, Line } from "recharts"
import { formatCompactBare } from "@lib/formatters"

/** Shared look of the age-by-wealth charts on the plan and journey pages. */
const TICK = { fontSize: 11, fill: "#94a3b8" }

export const WEALTH_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "#f1f5f9",
  vertical: false,
}

/** Add the age range as `domain` and `ticks`. */
export const WEALTH_AGE_AXIS_PROPS: XAxisProps = {
  dataKey: "age",
  type: "number",
  scale: "linear",
  allowDataOverflow: true,
  tick: TICK,
  tickLine: false,
  axisLine: false,
  label: {
    value: "Age",
    position: "insideBottom",
    offset: -10,
    ...TICK,
  },
}

export function wealthMoneyAxisProps(hideValues: boolean): YAxisProps {
  return {
    tickFormatter: hideValues ? () => "***" : formatCompactBare,
    tick: TICK,
    tickLine: false,
    axisLine: false,
    width: 54,
  }
}

/**
 * Monte Carlo confidence bands: stacked transparent base plus visible width,
 * and the median line. A plain function rather than a component so the series
 * stay direct children of the chart.
 */
export function monteCarloBands({
  outerName,
  innerName,
  medianName,
  hideFromLegend = false,
}: {
  outerName: string
  innerName: string
  medianName: string
  hideFromLegend?: boolean
}): React.ReactElement {
  const legend = hideFromLegend ? { legendType: "none" as const } : {}
  return (
    <>
      <Area
        type="monotone"
        dataKey="p10Base"
        fill="transparent"
        stroke="none"
        stackId="outer"
        {...legend}
        isAnimationActive={false}
      />
      <Area
        type="monotone"
        dataKey="outerWidth"
        fill="rgba(34,197,94,0.09)"
        stroke="none"
        stackId="outer"
        {...legend}
        isAnimationActive={false}
        name={outerName}
      />
      <Area
        type="monotone"
        dataKey="p25Base"
        fill="transparent"
        stroke="none"
        stackId="inner"
        {...legend}
        isAnimationActive={false}
      />
      <Area
        type="monotone"
        dataKey="innerWidth"
        fill="rgba(34,197,94,0.15)"
        stroke="none"
        stackId="inner"
        {...legend}
        isAnimationActive={false}
        name={innerName}
      />
      <Line
        type="monotone"
        dataKey="p50"
        stroke="rgba(34,197,94,0.55)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        dot={false}
        isAnimationActive={false}
        name={medianName}
      />
    </>
  )
}
