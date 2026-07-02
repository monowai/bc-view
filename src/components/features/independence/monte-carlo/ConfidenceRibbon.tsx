import React from "react"
import type { MonteCarloResult } from "types/independence"
import { deriveSurvivalCurve } from "@lib/independence/survivalCurve"

// ── FanChart alignment constants ─────────────────────────────────────────────
// FanChart uses: margin={{ top: 30, right: 30, left: 20, bottom: 40 }}
// Recharts default YAxis width = 60px.
// Ribbon left pad = left margin (20) + YAxis width (60) = 80px.
// Ribbon right pad = right margin (30).
// These constants mirror FanChart.tsx — update both if margins change.
export const RIBBON_PAD_LEFT = 80
export const RIBBON_PAD_RIGHT = 30

// ── Color buckets ─────────────────────────────────────────────────────────────
interface ColorBucket {
  min: number // inclusive lower bound
  color: string
  label: string
}

const COLOR_BUCKETS: ColorBucket[] = [
  { min: 0.95, color: "#15803d", label: "≥95% funded" },
  { min: 0.8, color: "#22c55e", label: "80–95%" },
  { min: 0.65, color: "#a3e635", label: "65–80%" },
  { min: 0.5, color: "#f59e0b", label: "50–65%" },
  { min: 0.35, color: "#f97316", label: "35–50%" },
  { min: 0, color: "#ef4444", label: "<35%" },
]

function survivalColor(survival: number): string {
  for (const bucket of COLOR_BUCKETS) {
    if (survival >= bucket.min) return bucket.color
  }
  return COLOR_BUCKETS[COLOR_BUCKETS.length - 1].color
}

// ── Headline pill tone — mirrors MonteCarloResultView.successRateBg ──────────
function headlinePillClass(successRate: number): string {
  if (successRate >= 80) return "bg-green-100 text-green-800"
  if (successRate >= 50) return "bg-amber-100 text-amber-800"
  return "bg-red-100 text-red-800"
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ConfidenceRibbonProps {
  result: MonteCarloResult
}

/**
 * Confidence Ribbon — horizontal per-age survival-probability strip.
 *
 * Rendered directly beneath the FanChart in MonteCarloResultView. Derived
 * 100% client-side from the MonteCarloResult response; zero new API fields.
 *
 * Accessibility: the ribbon row carries role="img" + aria-label so screen
 * readers get the headline without traversing 30+ coloured cells.
 */
export function ConfidenceRibbon({
  result,
}: ConfidenceRibbonProps): React.ReactElement | null {
  const curve = deriveSurvivalCurve(result)

  if (curve.points.length === 0) return null

  const { points, thresholds, headline } = curve

  // Which color buckets are actually present in this curve?
  const usedColors = new Set(points.map((p) => survivalColor(p.survival)))
  const presentBuckets = COLOR_BUCKETS.filter((b) => usedColors.has(b.color))

  // Position of a threshold label as a percentage of the ribbon content width
  function thresholdPositionPct(age: number): number {
    if (points.length === 0) return 0
    const first = points[0].age
    const last = points[points.length - 1].age
    if (last === first) return 0
    return ((age - first) / (last - first)) * 100
  }

  return (
    <div className="bg-white rounded-xl shadow-md px-6 pb-6 pt-4 -mt-3">
      {/* Headline pill */}
      <div className="mb-2">
        <span
          className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${headlinePillClass(result.successRate)}`}
        >
          {headline}
        </span>
      </div>

      {/* Ribbon strip + threshold labels wrapper */}
      <div className="relative">
        {/* Ribbon strip — padded left/right to align with FanChart Y-axis */}
        <div
          role="img"
          aria-label={headline}
          className="flex rounded overflow-hidden"
          style={{
            paddingLeft: RIBBON_PAD_LEFT,
            paddingRight: RIBBON_PAD_RIGHT,
            height: 14,
          }}
        >
          {points.map(({ age, survival }) => {
            const outOf100 = Math.round(survival * 100)
            return (
              <div
                key={age}
                className="flex-1"
                style={{ backgroundColor: survivalColor(survival) }}
                title={`Age ${age} — in ${outOf100} out of 100 futures you still have money`}
              />
            )
          })}
        </div>

        {/* Threshold labels rendered relative to the ribbon content area */}
        <div
          className="relative"
          style={{
            marginLeft: RIBBON_PAD_LEFT,
            marginRight: RIBBON_PAD_RIGHT,
            height: 20,
          }}
        >
          {thresholds.p90 != null && (
            <span
              className="absolute text-[9px] text-gray-500 whitespace-nowrap"
              style={{
                left: `${thresholdPositionPct(thresholds.p90)}%`,
                transform: "translateX(-50%)",
                top: 3,
              }}
            >
              90% → {thresholds.p90}
            </span>
          )}
          {thresholds.p75 != null && (
            <span
              className="absolute text-[9px] text-gray-500 whitespace-nowrap"
              style={{
                left: `${thresholdPositionPct(thresholds.p75)}%`,
                transform: "translateX(-50%)",
                top: 3,
              }}
            >
              75% → {thresholds.p75}
            </span>
          )}
          {thresholds.p50 != null && (
            <span
              className="absolute text-[9px] text-gray-500 whitespace-nowrap"
              style={{
                left: `${thresholdPositionPct(thresholds.p50)}%`,
                transform: "translateX(-50%)",
                top: 3,
              }}
            >
              50% → {thresholds.p50}
            </span>
          )}
        </div>
      </div>

      {/* Legend — only render buckets that are actually present */}
      {presentBuckets.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-5">
          {presentBuckets.map((bucket) => (
            <div key={bucket.color} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: bucket.color }}
              />
              <span className="text-[10px] text-gray-500">{bucket.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
