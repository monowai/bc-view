import React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import {
  ACTIVE_DOT,
  CHART_COLORS,
  DATE_AXIS_PROPS,
  TOOLTIP_STYLE,
  VALUE_AXIS_PROPS,
  formatTooltipDate,
  referenceLineProps,
} from "@lib/chart/performanceConstants"

interface GainAreaChartProps {
  data: Array<{ date: string; investmentGain: number }>
  /** SVG gradient id; unique per chart, both can share a page. */
  gradientId: string
  formatTick: (value: number) => string
  formatTooltipValue: (value: number) => string
}

/** Investment gain over time, drawn from each row's `investmentGain`. */
const GainAreaChart: React.FC<GainAreaChartProps> = ({
  data,
  gradientId,
  formatTick,
  formatTooltipValue,
}) => (
  <div className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={CHART_COLORS.accent}
              stopOpacity={0.15}
            />
            <stop
              offset="100%"
              stopColor={CHART_COLORS.accent}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <XAxis {...DATE_AXIS_PROPS} />
        <YAxis {...VALUE_AXIS_PROPS} tickFormatter={formatTick} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(label) => formatTooltipDate(String(label))}
          formatter={(value) => [formatTooltipValue(Number(value)), "Gain"]}
        />
        <ReferenceLine {...referenceLineProps(0, "Break-even")} />
        <Area
          type="monotone"
          dataKey="investmentGain"
          stroke={CHART_COLORS.accent}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={ACTIVE_DOT}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
)

export default GainAreaChart
