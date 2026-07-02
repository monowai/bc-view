import React from "react"
import type {
  JourneyRibbonData,
  JourneyStatus,
} from "@lib/independence/journeyRibbon"

// These constants mirror the ComposedChart margin + Recharts default YAxis width
// in TimelineTabContent.tsx and WealthJourneyTab.tsx (both use the same values).
// chartMargin.left=20 + rechartsDefaultYAxisWidth=60 = 80; chartMargin.right=30.
// Update here if the chart margin or YAxis width prop changes.
const RIBBON_LEFT_PX = 80
const RIBBON_RIGHT_PX = 30

const STATUS_COLOR: Record<JourneyStatus, string> = {
  building: "#14b8a6",
  covered: "#22c55e",
  onTrack: "#a3e635",
  thinning: "#f59e0b",
  shortfall: "#ef4444",
}

const STATUS_LABEL: Record<JourneyStatus, string> = {
  building: "Building wealth",
  covered: "Income covered",
  onTrack: "On track",
  thinning: "Thinning",
  shortfall: "Shortfall",
}

const VERDICT_STYLE: Record<
  "good" | "warn" | "bad",
  { bg: string; text: string; glyph: string }
> = {
  good: { bg: "bg-green-100", text: "text-green-800", glyph: "✓" },
  warn: { bg: "bg-amber-100", text: "text-amber-800", glyph: "⚠" },
  bad: { bg: "bg-red-100", text: "text-red-800", glyph: "⚠" },
}

interface JourneyRibbonProps {
  data: JourneyRibbonData
}

export default function JourneyRibbon({
  data,
}: JourneyRibbonProps): React.ReactElement {
  const { cells, verdict, verdictTone } = data
  const style = VERDICT_STYLE[verdictTone]

  // Collect unique statuses present in the data for the compact legend
  const presentStatuses = Array.from(
    new Set(cells.map((c) => c.status)),
  ) as JourneyStatus[]

  return (
    <div className="mt-2 space-y-1.5">
      {/* Verdict pill */}
      {verdict && (
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
        >
          <span>{style.glyph}</span>
          {verdict}
        </span>
      )}

      {/* Ribbon row — padded to align with chart plot area */}
      <div
        role="img"
        aria-label={`Journey ribbon: ${verdict}`}
        className="overflow-hidden rounded"
        style={{
          paddingLeft: RIBBON_LEFT_PX,
          paddingRight: RIBBON_RIGHT_PX,
        }}
      >
        <div className="flex" style={{ height: 14 }}>
          {cells.map((cell) => (
            <div
              key={cell.age}
              className="flex-1 cursor-default"
              style={{ backgroundColor: STATUS_COLOR[cell.status] }}
              title={cell.note}
            />
          ))}
        </div>
      </div>

      {/* Compact legend — only statuses present in this ribbon */}
      {presentStatuses.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {presentStatuses.map((status) => (
            <span key={status} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
