import React from "react"
import type { XAxisProps, YAxisProps } from "recharts"
import { Area, Line } from "recharts"
import { formatCompactBare } from "@lib/formatters"
import { CHART_PALETTE, CHART_TICK, OUTCOME_BANDS } from "@lib/chartPalette"

/** Shared look of the age-by-wealth charts on the plan and journey pages. */
const TICK = CHART_TICK

export const WEALTH_GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: CHART_PALETTE.gridFaint,
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
        fill={OUTCOME_BANDS.outer}
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
        fill={OUTCOME_BANDS.inner}
        stroke="none"
        stackId="inner"
        {...legend}
        isAnimationActive={false}
        name={innerName}
      />
      <Line
        type="monotone"
        dataKey="p50"
        stroke={OUTCOME_BANDS.median}
        strokeWidth={1.5}
        strokeDasharray="5 4"
        dot={false}
        isAnimationActive={false}
        name={medianName}
      />
    </>
  )
}
