import React from "react"
import type { Currency } from "types/beancounter"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import type {
  WorkingBasis,
  WorkingOutlook,
} from "@lib/independence/workingBasis"
import { METRIC_CLS } from "@components/features/wealth/RetiredMetrics"

const LABEL_CLS = "text-xs font-medium text-gray-500 mb-1"
const VALUE_CLS = "text-2xl font-bold tabular-nums text-gray-900"
const UNIT_CLS = "text-sm text-gray-500"
const NOTE_CLS = "text-xs text-gray-500 mt-2"
const MUTED_VALUE = <span className="text-2xl font-bold text-gray-500">—</span>
const HIDDEN_VALUE = (
  <span className="text-2xl font-bold text-gray-500">****</span>
)
const SKELETON = (
  <>
    <div className="h-9 w-20 bg-gray-200 rounded animate-pulse"></div>
    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mt-2"></div>
  </>
)

interface WorkingMetricsProps {
  /** The journey, or the lone phase, the tiles report on; null while it loads. */
  basis: WorkingBasis | null
  /** A projection is still on its way. */
  loading: boolean
  /** Net invested over the last 30 days, in the display currency. */
  invested: number | undefined
  displayCurrency: Currency | null
  onShowInvestments: () => void
}

function Tile({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className={METRIC_CLS}>
      <p className={LABEL_CLS}>{label}</p>
      {children}
    </div>
  )
}

function investedNote(
  isNegative: boolean,
  target: number | undefined,
  targetCurrency: string | null,
  progress: number,
): string {
  if (isNegative) return "Net withdrawal (last 30 days)"
  if (target === undefined) return "Monthly target unavailable"
  if (targetCurrency) return `Target is in ${targetCurrency}`
  if (progress >= 100) return "Target met!"
  return `${progress.toFixed(0)}% of monthly target`
}

function MonthlyInvestment({
  basis,
  invested,
  displayCurrency,
  onShowInvestments,
}: {
  basis: WorkingBasis
  invested: number | undefined
  displayCurrency: Currency | null
  onShowInvestments: () => void
}): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const target =
    basis.monthlyContribution === undefined
      ? undefined
      : Math.round(basis.monthlyContribution)
  const actual = Math.round(invested ?? 0)
  const symbol = displayCurrency?.symbol || ""
  // A target in another currency is labelled as such and not compared: the
  // amount invested is in the display currency.
  const targetCurrency =
    basis.currency !== undefined &&
    displayCurrency != null &&
    basis.currency !== displayCurrency.code
      ? basis.currency
      : null
  const progress =
    target !== undefined && target > 0 && !targetCurrency
      ? (actual / target) * 100
      : 0
  const isNegative = actual < 0
  const met = progress >= 100
  let valueCls = "text-gray-900"
  let barCls = "bg-independence-500"
  if (isNegative) {
    valueCls = "text-loss"
    barCls = "bg-loss"
  } else if (met) {
    valueCls = "text-gain"
    barCls = "bg-gain"
  }
  return (
    <>
      <button
        type="button"
        onClick={() => !hideValues && onShowInvestments()}
        className={`flex items-baseline gap-2 ${hideValues ? "" : "cursor-pointer hover:opacity-80"}`}
        disabled={hideValues}
      >
        {hideValues ? (
          HIDDEN_VALUE
        ) : (
          <>
            <span className={`text-2xl font-bold tabular-nums ${valueCls}`}>
              {isNegative ? "-" : ""}
              {symbol}
              {Math.abs(actual).toLocaleString()}
            </span>
            {target !== undefined && (
              <span className={UNIT_CLS}>
                / {targetCurrency ? `${targetCurrency} ` : symbol}
                {target.toLocaleString()}
              </span>
            )}
            <i className="fas fa-external-link-alt text-xs text-gray-400 ml-1"></i>
          </>
        )}
      </button>
      <div className="mt-2 bg-gray-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barCls}`}
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
      <p className={NOTE_CLS}>
        {investedNote(isNegative, target, targetCurrency, progress)}
      </p>
    </>
  )
}

function Headline({
  outlook,
}: {
  outlook: WorkingOutlook
}): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  const { headline } = outlook
  return (
    <>
      <div className="flex items-baseline gap-2">
        {hideValues ? (
          HIDDEN_VALUE
        ) : (
          <span className={VALUE_CLS}>{headline.display}</span>
        )}
      </div>
      <div className="mt-2 bg-gray-100 rounded-full h-1.5">
        <div
          className="bg-independence-500 h-1.5 rounded-full transition-all"
          style={{ width: hideValues ? "0%" : `${headline.fillPercent}%` }}
        />
      </div>
      {!hideValues && (
        <p className={NOTE_CLS}>
          {outlook.independent ? "Financially Independent!" : headline.byline}
        </p>
      )}
    </>
  )
}

function yearsNote(outlook: WorkingOutlook): string {
  if (outlook.independent) return "You've reached financial independence!"
  if (outlook.fiAge) return `FI at age ${outlook.fiAge}`
  return "Keep investing to reach FI"
}

function YearsToFi({
  outlook,
}: {
  outlook: WorkingOutlook
}): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  if (hideValues) return HIDDEN_VALUE
  let value = MUTED_VALUE
  if (outlook.independent) {
    value = <span className="text-2xl font-bold text-gain">FI Achieved!</span>
  } else if (outlook.yearsToFi != null) {
    value = (
      <>
        <span className={VALUE_CLS}>{outlook.yearsToFi}</span>
        <span className={UNIT_CLS}>years</span>
      </>
    )
  }
  return (
    <>
      <div className="flex items-baseline gap-2">{value}</div>
      <p className={NOTE_CLS}>{yearsNote(outlook)}</p>
    </>
  )
}

function PropertySale({
  outlook,
}: {
  outlook: WorkingOutlook
}): React.ReactElement {
  const { hideValues } = usePrivacyMode()
  if (hideValues) return HIDDEN_VALUE
  const { liquidationAge, hasProperty } = outlook
  let value = MUTED_VALUE
  let note: string | null = null
  if (liquidationAge) {
    value = (
      <>
        <span className={VALUE_CLS}>{liquidationAge}</span>
        <span className={UNIT_CLS}>years old</span>
      </>
    )
    note = "When liquid assets run low"
  } else if (hasProperty) {
    value = <span className="text-2xl font-bold text-gain">Not needed</span>
    note = "Liquid assets sufficient"
  } else if (hasProperty === false) {
    value = <span className="text-2xl font-bold text-gray-500">N/A</span>
    note = "No illiquid assets"
  }
  return (
    <>
      <div className="flex items-baseline gap-2">{value}</div>
      {note && <p className={NOTE_CLS}>{note}</p>}
    </>
  )
}

/**
 * Saving-phase cards for a plan owner still working: what is being invested
 * against target, how far along, how long to go, and whether property is sold.
 */
export default function WorkingMetrics({
  basis,
  loading,
  invested,
  displayCurrency,
  onShowInvestments,
}: WorkingMetricsProps): React.ReactElement {
  const outlook = basis?.outlook ?? null
  const showOutlook = loading || outlook !== null
  return (
    <div
      className={`grid grid-cols-1 gap-y-4 ${showOutlook ? "sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-100" : ""}`}
    >
      <Tile label="Monthly Investment">
        {basis ? (
          <MonthlyInvestment
            basis={basis}
            invested={invested}
            displayCurrency={displayCurrency}
            onShowInvestments={onShowInvestments}
          />
        ) : (
          SKELETON
        )}
      </Tile>
      {showOutlook && (
        <>
          <Tile label={outlook ? outlook.headline.label : "Progress"}>
            {outlook ? <Headline outlook={outlook} /> : SKELETON}
          </Tile>
          <Tile label="Years to FI">
            {outlook ? <YearsToFi outlook={outlook} /> : SKELETON}
          </Tile>
          <Tile label="Property Sale Age">
            {outlook ? <PropertySale outlook={outlook} /> : SKELETON}
          </Tile>
        </>
      )}
    </div>
  )
}
