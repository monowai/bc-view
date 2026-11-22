/**
 * Chart and status colours from the design system (DESIGN.md "Colors").
 *
 * Recharts and inline styles need literal colour strings, so the values here
 * mirror the `@theme` tokens in styles/globals.css. Use these instead of raw
 * hex in components: a colour either carries meaning (gain, loss, warning, a
 * capability domain) or it is a gray neutral.
 */

/** Gray neutral scale (Tailwind gray). */
export const GRAY = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
} as const

/** Wealth Blue — net worth and portfolio value (--color-wealth-*). */
export const WEALTH = {
  50: "#eff6ff",
  100: "#dbeafe",
  200: "#bfdbfe",
  500: "#3b82f6",
  600: "#2563eb",
  700: "#1d4ed8",
} as const

/** Independence Orange — retirement / FI projections (--color-independence-*). */
export const INDEPENDENCE = {
  50: "#fff7ed",
  100: "#ffedd5",
  200: "#fed7aa",
  500: "#f97316",
  600: "#ea580c",
  700: "#c2410c",
} as const

/** Invest Emerald — allocation, rebalancing, contributions (--color-invest-*). */
export const INVEST = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
} as const

/** Action Blue (--color-primary). */
export const PRIMARY = "#2563eb"

/** Financial status hues (--color-gain, --color-loss, --color-warning). */
export const GAIN = "#047857"
export const LOSS = "#dc2626"
export const WARNING = "#a16207"

/** Semantic chart roles. */
export const CHART_PALETTE = {
  /** Grid lines and axis strokes. */
  grid: GRAY[200],
  /** Very light grid for dense area charts. */
  gridFaint: GRAY[100],
  /** Non-text strokes: baselines, comparison lines, neutral markers. */
  strokeMuted: GRAY[400],
  /** Axis ticks, labels and any chart text — never lighter than gray-500. */
  text: GRAY[500],
  /** Strong neutral series (e.g. the main balance line). */
  ink: GRAY[800],
  surface: "#ffffff",
  gain: GAIN,
  loss: LOSS,
  warning: WARNING,
  primary: PRIMARY,
  wealth: WEALTH[500],
  independence: INDEPENDENCE[500],
  invest: INVEST[500],
} as const

/**
 * Categorical series built only from design-system hues. Order alternates hue
 * then lightness so neighbouring series stay distinct.
 */
export const CHART_SERIES = [
  WEALTH[500],
  INDEPENDENCE[500],
  INVEST[500],
  GRAY[500],
  WEALTH[700],
  INDEPENDENCE[700],
  INVEST[700],
] as const

/** Shared axis tick style for the plan / wealth charts. */
export const CHART_TICK = { fontSize: 11, fill: CHART_PALETTE.text } as const

/** Monte Carlo outcome bands: the gain hue at low opacity. */
export const OUTCOME_BANDS = {
  outer: "rgba(5,150,105,0.09)",
  inner: "rgba(5,150,105,0.15)",
  median: "rgba(5,150,105,0.55)",
} as const
