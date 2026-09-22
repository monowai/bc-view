import React from "react"
import type { AssumptionSource, PhaseAssumptions } from "types/independence"
import { toPercent } from "@lib/independence/conversions"

/** Provenance copy, keyed by what the engine echoed. */
export const SOURCE_LABEL: Record<AssumptionSource, string> = {
  JOURNEY: "Inherits from journey",
  STAGE: "Own assumptions",
  MIXED: "Mixed",
}

/** Journey-rate order for the per-stage readouts. */
export const EFFECTIVE_RATE_ORDER: {
  key: keyof Omit<PhaseAssumptions, "source">
  short: string
}[] = [
  { key: "cashReturnRate", short: "cash" },
  { key: "equityReturnRate", short: "equity" },
  { key: "housingReturnRate", short: "housing" },
  { key: "inflationRate", short: "inflation" },
  { key: "feeRate", short: "fees" },
  { key: "investmentTaxRate", short: "tax" },
]

/** "cash 1.5% · equity 8% · …" — the six rates a stage actually ran on. */
export function effectiveRatesLine(assumptions: PhaseAssumptions): string {
  return EFFECTIVE_RATE_ORDER.map(
    ({ key, short }) => `${short} ${toPercent(assumptions[key], 1)}%`,
  ).join(" · ")
}

/**
 * The six rates as a row of labelled figures — label above, figure below —
 * so each one has room and the eye can scan the row. For the drawer, where
 * the joined line had no width to sit in.
 */
export function EffectiveRatesGrid({
  assumptions,
}: {
  assumptions: PhaseAssumptions
}): React.ReactElement {
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
      {EFFECTIVE_RATE_ORDER.map(({ key, short }) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-gray-500">{short}</dt>
          <dd className="font-mono text-sm tabular-nums text-gray-900">
            {toPercent(assumptions[key], 1)}%
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Provenance, toned: quiet when the stage simply inherits, amber otherwise. */
export function ProvenanceLabel({
  source,
}: {
  source: AssumptionSource
}): React.ReactElement {
  return (
    <span
      className={`text-xs font-medium ${
        source === "JOURNEY" ? "text-gray-500" : "text-amber-700"
      }`}
    >
      {SOURCE_LABEL[source]}
    </span>
  )
}

interface StageRateSwitchProps {
  /** Accessible name; the visible row label is elsewhere. */
  label: string
  /** True when the stage runs on the journey's rates. */
  inherits: boolean
  disabled?: boolean
  onChange: (inherits: boolean) => void
}

/**
 * On = the stage's own rates, off = the journey's — the same polarity as the
 * stage wizard's "Override for this stage", so the two places this can be set
 * read alike.
 *
 * A <button role="switch">, not an input wrapped in a label: that pairing
 * double-fires in this codebase.
 */
export function StageRateSwitch({
  label,
  inherits,
  disabled = false,
  onChange,
}: StageRateSwitchProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={!inherits}
      disabled={disabled}
      onClick={() => onChange(!inherits)}
      className={`${
        inherits ? "bg-gray-200" : "bg-independence-600"
      } relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-independence-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none`}
    >
      <span
        className={`${
          inherits ? "translate-x-0" : "translate-x-5"
        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out motion-reduce:transition-none`}
      />
    </button>
  )
}
