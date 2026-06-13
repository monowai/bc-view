import React from "react"

/**
 * Illustrative SVG motifs for the marketing landing. These are NOT real user
 * data — they are hand-shaped curves that explain each pillar's question.
 * Every figure is set in the mono face to match the app's data voice.
 *
 * Self-draw animation is opt-in via a `.ld-animate` ancestor class (added by
 * the IntersectionObserver in MarketingLanding). Without that class the paths
 * render fully drawn, so headless renderers and reduced-motion users always
 * see the complete chart — the draw is an enhancement, never a gate.
 */

const AXIS = "#e5e7eb" // border / gridline

/**
 * Hero motif (light-on-dark). A climbing net-worth line on the slate hero —
 * gives the headline a counterweight on wide viewports. Illustrative, labelled.
 */
export function HeroChart(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 480 320"
      className="w-full h-auto"
      role="img"
      aria-label="Illustrative net-worth chart climbing over time, ending around $248,310."
      preserveAspectRatio="xMidYMid meet"
    >
      <title>One honest picture of your wealth</title>
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint gridlines */}
      {[80, 140, 200, 260].map((y) => (
        <line
          key={y}
          x1="24"
          y1={y}
          x2="456"
          y2={y}
          stroke="#ffffff"
          strokeOpacity="0.06"
          strokeWidth="1"
        />
      ))}
      {/* area */}
      <path
        d="M24 276 L120 250 L216 214 L312 150 L408 92 L456 64 L456 288 L24 288 Z"
        fill="url(#hero-area)"
      />
      {/* climbing line */}
      <path
        className="ld-draw ld-draw--lead"
        pathLength={1}
        d="M24 276 L120 250 L216 214 L312 150 L408 92 L456 64"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="ld-dot" cx="456" cy="64" r="5.5" fill="#93c5fd" />
      {/* figure + colourblind-safe gain marker */}
      <text
        x="24"
        y="44"
        className="font-mono"
        fontSize="30"
        fontWeight="600"
        fill="#ffffff"
      >
        $248,310
      </text>
      <text
        x="26"
        y="68"
        className="font-mono"
        fontSize="14"
        fontWeight="500"
        fill="#6ee7b7"
      >
        ▲ 18.2% / yr
      </text>
      <text
        x="456"
        y="44"
        textAnchor="end"
        className="font-sans"
        fontSize="13"
        fill="#94a3b8"
      >
        Net worth
      </text>
    </svg>
  )
}

/** Wealth — "What do I have?" Broker lines converging into one total. */
export function NetWorthChart(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 400 240"
      className="w-full h-auto"
      role="img"
      aria-label="Illustrative net-worth chart: several broker balances combining into one rising total."
      preserveAspectRatio="xMidYMid meet"
    >
      <title>Net worth across brokers, assets and currencies</title>
      {/* baseline */}
      <line x1="32" y1="208" x2="384" y2="208" stroke={AXIS} strokeWidth="1" />
      {/* faint contributing broker lines */}
      <path
        className="ld-draw"
        pathLength={1}
        d="M32 196 L120 182 L208 170 L296 150 L384 132"
        fill="none"
        stroke="#bfdbfe"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="ld-draw"
        pathLength={1}
        d="M32 204 L120 196 L208 184 L296 176 L384 160"
        fill="none"
        stroke="#dbeafe"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* area under the bold total */}
      <path
        d="M32 188 L120 168 L208 140 L296 96 L384 56 L384 208 L32 208 Z"
        fill="#3b82f6"
        fillOpacity="0.08"
      />
      {/* bold total net-worth line */}
      <path
        className="ld-draw ld-draw--lead"
        pathLength={1}
        d="M32 188 L120 168 L208 140 L296 96 L384 56"
        fill="none"
        stroke="#2563eb"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="ld-dot" cx="384" cy="56" r="4.5" fill="#2563eb" />
      <text
        x="372"
        y="40"
        textAnchor="end"
        className="font-mono"
        fontSize="15"
        fontWeight="600"
        fill="#1d4ed8"
      >
        $248,310
      </text>
    </svg>
  )
}

/** Independence — "What do I want?" Wealth curve crossing the freedom line. */
export function ProjectionChart(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 400 240"
      className="w-full h-auto"
      role="img"
      aria-label="Illustrative projection: a wealth curve rising past the point where work becomes optional."
      preserveAspectRatio="xMidYMid meet"
    >
      <title>When work becomes optional</title>
      <line x1="32" y1="208" x2="384" y2="208" stroke={AXIS} strokeWidth="1" />
      {/* freedom threshold — the income your plan needs to cover */}
      <line
        x1="32"
        y1="104"
        x2="384"
        y2="104"
        stroke="#fdba74"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
      <text
        x="36"
        y="96"
        className="font-sans"
        fontSize="11"
        fontWeight="500"
        fill="#c2410c"
      >
        Freedom line
      </text>
      {/* accumulation curve */}
      <path
        className="ld-draw ld-draw--lead"
        pathLength={1}
        d="M32 200 C 130 196, 190 168, 236 104 C 276 50, 330 36, 384 28"
        fill="none"
        stroke="#ea580c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* crossover marker — where curve meets the freedom line */}
      <circle
        className="ld-pulse"
        cx="236"
        cy="104"
        r="9"
        fill="#f97316"
        fillOpacity="0.25"
      />
      <circle className="ld-dot" cx="236" cy="104" r="4.5" fill="#ea580c" />
      <text
        x="236"
        y="130"
        textAnchor="middle"
        className="font-sans"
        fontSize="11"
        fontWeight="600"
        fill="#c2410c"
      >
        Work optional
      </text>
    </svg>
  )
}

type Segment = { label: string; value: number; color: string }

const SEGMENTS: Segment[] = [
  { label: "Equities", value: 55, color: "#10b981" },
  { label: "Bonds", value: 25, color: "#34d399" },
  { label: "Cash", value: 12, color: "#a7f3d0" },
  { label: "Other", value: 8, color: "#047857" },
]

/** Invest — "How do I get there?" Target allocation ring. */
export function AllocationRing(): React.ReactElement {
  const r = 78
  const cx = 110
  const cy = 120
  const circ = 2 * Math.PI * r
  // Cumulative arc length before each segment — computed without mutation so
  // the render stays pure (React Compiler forbids reassigning across the map).
  const startOffset = (i: number): number =>
    SEGMENTS.slice(0, i).reduce((sum, s) => sum + (s.value / 100) * circ, 0)
  return (
    <svg
      viewBox="0 0 360 240"
      className="w-full h-auto"
      role="img"
      aria-label="Illustrative target allocation: equities 55 percent, bonds 25 percent, cash 12 percent, other 8 percent."
      preserveAspectRatio="xMidYMid meet"
    >
      <title>Turn goals into a rebalanceable model</title>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {SEGMENTS.map((s, i) => {
          const len = (s.value / 100) * circ
          const dash = `${len} ${circ - len}`
          const dashoffset = -startOffset(i)
          return (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="22"
              strokeDasharray={dash}
              strokeDashoffset={dashoffset}
            />
          )
        })}
      </g>
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        className="font-mono"
        fontSize="22"
        fontWeight="600"
        fill="#047857"
      >
        100%
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        className="font-sans"
        fontSize="11"
        fill="#6b7280"
      >
        target model
      </text>
      {/* legend */}
      <g className="font-sans" fontSize="12">
        {SEGMENTS.map((s, i) => {
          const y = 70 + i * 28
          return (
            <g key={s.label} transform={`translate(232 ${y})`}>
              <rect width="12" height="12" rx="2" y="-10" fill={s.color} />
              <text x="20" y="0" fill="#111827" fontWeight="500">
                {s.label}
              </text>
              <text
                x="118"
                y="0"
                textAnchor="end"
                className="font-mono"
                fill="#374151"
              >
                {s.value}%
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
