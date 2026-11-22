import React from "react"
import { NumericFormat } from "react-number-format"
import { useRouter } from "next/router"
import useSwr from "swr"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { eventKey, simpleFetcher, tradeKey } from "@utils/api/fetchHelper"
import { Transaction } from "types/beancounter"
import { TabSignal, tabSignal } from "@utils/trns/trnListView"

interface TrnNumberProps {
  value: number | undefined
  scale: number
  /** Pad to `scale` decimals. When false, `scale` is only a maximum. */
  fixed?: boolean
  prefix?: string
  /** Show zero or a missing value as a faint dash, so non-zero figures stand out. */
  blankZero?: boolean
}

/** A figure in the data face: monospace, tabular numerals, aligned to the decimal. */
export function TrnNumber({
  value,
  scale,
  fixed = true,
  prefix,
  blankZero = false,
}: TrnNumberProps): React.ReactElement {
  if (blankZero && !value) {
    return (
      <span className="font-mono text-gray-300" aria-label="zero">
        {"–"}
      </span>
    )
  }
  return (
    <span className="font-mono tabular-nums">
      <NumericFormat
        value={value}
        displayType={"text"}
        decimalScale={scale}
        fixedDecimalScale={fixed}
        thousandSeparator={true}
        prefix={prefix}
      />
    </span>
  )
}

export function TrnNumberCell({
  className = "px-4 py-3 text-right whitespace-nowrap",
  ...number
}: TrnNumberProps & { className?: string }): React.ReactElement {
  return (
    <td className={className}>
      <TrnNumber {...number} />
    </td>
  )
}

export function TrnCardValue({
  label,
  labelClassName = "text-gray-500",
  valueClassName = "ml-1 font-medium",
  ...number
}: TrnNumberProps & {
  label: string
  labelClassName?: string
  valueClassName?: string
}): React.ReactElement {
  return (
    <div>
      <span className={labelClassName}>{label}:</span>
      <span className={valueClassName}>
        <TrnNumber {...number} />
      </span>
    </div>
  )
}

export interface TrnColumn {
  label: string
  align?: "left" | "right" | "center"
  /** Faint qualifier after the label, such as the currency every row shares. */
  hint?: string
  /** Visually hidden label, for icon-only columns such as row actions. */
  srOnly?: boolean
}

const HEAD_ALIGN = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
}

export function TrnTableHead({
  columns,
  cellClassName = "px-4 py-3",
}: {
  columns: TrnColumn[]
  /** Padding for each header cell; match the body cells. */
  cellClassName?: string
}): React.ReactElement {
  return (
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        {columns.map(({ label, align = "left", hint, srOnly }) => (
          <th
            key={label}
            scope="col"
            className={`${cellClassName} ${HEAD_ALIGN[align]} text-xs font-medium tracking-wide text-gray-500 whitespace-nowrap`}
          >
            {srOnly ? <span className="sr-only">{label}</span> : label}
            {hint && (
              <span className="ml-1 font-mono font-normal text-gray-500">
                {hint}
              </span>
            )}
          </th>
        ))}
      </tr>
    </thead>
  )
}

const titleCase = (value: string): string =>
  value.charAt(0) + value.slice(1).toLowerCase()

/**
 * Settled is the normal case, so it stays quiet; anything else — chiefly
 * Proposed — is the exception the eye should find.
 */
export function TrnStatusBadge({
  status,
}: {
  status: string
}): React.ReactElement {
  if (status === "SETTLED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <span aria-hidden="true">
          <i className="fas fa-check text-xs text-green-700"></i>
        </span>
        {"Settled"}
      </span>
    )
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${
        status === "PROPOSED"
          ? "bg-yellow-50 border-yellow-200 text-yellow-800"
          : "bg-gray-50 border-gray-200 text-gray-700"
      }`}
    >
      {titleCase(status)}
    </span>
  )
}

/** Inflows read green and outflows red; the label always carries the meaning. */
function trnTypeTone(trnType: string): string {
  switch (trnType) {
    case "BUY":
    case "INCOME":
    case "DEPOSIT":
      return "bg-green-50 text-green-800 border-green-200"
    case "SELL":
    case "EXPENSE":
    case "DEDUCTION":
    case "WITHDRAWAL":
      return "bg-red-50 text-red-800 border-red-200"
    case "COST_ADJUST":
      return "bg-orange-50 text-orange-800 border-orange-200"
    default:
      return "bg-blue-50 text-blue-800 border-blue-200"
  }
}

export function TrnTypeBadge({
  trnType,
}: {
  trnType: string
}): React.ReactElement {
  return (
    <span
      className={`inline-block min-w-[3.25rem] text-center px-1.5 py-0.5 text-xs font-semibold tracking-wide rounded border ${trnTypeTone(trnType)}`}
    >
      {trnType.replace("_", " ")}
    </span>
  )
}

export function TrnRowActions({
  onEdit,
  onCopy,
  onDelete,
}: {
  onEdit: () => void
  onCopy: (e: React.MouseEvent) => void
  /** Omit to hide the delete button. */
  onDelete?: () => void
}): React.ReactElement {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="text-gray-500 hover:text-blue-700 p-1 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
        title={"Edit"}
        aria-label={"Edit"}
      >
        <i className="fas fa-edit"></i>
      </button>
      <button
        type="button"
        onClick={onCopy}
        className="text-gray-500 hover:text-gray-700 p-1 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
        title={"Copy row"}
        aria-label={"Copy row"}
      >
        <i className="fas fa-copy"></i>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-gray-500 hover:text-red-700 p-1 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
          title={"Delete"}
          aria-label={"Delete"}
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      )}
    </div>
  )
}

export function TrnPageNav({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}): React.ReactElement {
  const router = useRouter()
  return (
    <nav className="bg-white shadow-sm sticky top-0 z-10">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <i className="fa fa-arrow-left mr-2"></i>
            <span className="hidden sm:inline">{"Back"}</span>
          </button>
          <div className="flex-1 text-lg font-semibold text-center truncate">
            {title}
            <span className="text-gray-500 text-sm ml-2">{subtitle}</span>
          </div>
          <div className="w-16"></div>
        </div>
      </div>
    </nav>
  )
}

export function TrnEmptyState({
  id,
  title = "No transactions found",
  description,
}: {
  id?: string
  title?: string
  description?: string
}): React.ReactElement {
  const router = useRouter()
  return (
    <div id={id} className="text-center py-12">
      <p className="text-lg text-gray-500">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
          {description}
        </p>
      )}
      <button
        type="button"
        onClick={() => router.back()}
        className="mt-5 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
      >
        <i className="fa fa-arrow-left mr-2"></i>
        {"Back"}
      </button>
    </div>
  )
}

const TAB =
  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-2 focus-visible:outline-blue-500"
const ACTIVE_TAB = `${TAB} border-blue-600 text-blue-700`
const INACTIVE_TAB = `${TAB} border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300`

export interface TrnTabSignals {
  trades?: TabSignal
  events?: TabSignal
}

/**
 * Row counts for the Trades and Events tabs of one holding. Uses the same SWR
 * keys as the two pages, so the active tab's list is not fetched twice.
 */
export function useTrnTabSignals(
  portfolioId: string | undefined,
  assetId: string | undefined,
): TrnTabSignals {
  const ready = !!portfolioId && !!assetId
  const tradesUrl = ready ? tradeKey(portfolioId!, assetId!) : null
  const eventsUrl = ready ? eventKey(portfolioId!, assetId!) : null
  const trades = useSwr(tradesUrl, tradesUrl ? simpleFetcher(tradesUrl) : null)
  const events = useSwr(eventsUrl, eventsUrl ? simpleFetcher(eventsUrl) : null)
  return {
    trades: tabSignal(trades.data?.data as Transaction[] | undefined),
    events: tabSignal(events.data?.data as Transaction[] | undefined),
  }
}

function TabCount({
  signal,
  active,
}: {
  signal: TabSignal | undefined
  active: boolean
}): React.ReactElement | null {
  if (!signal) return null
  if (signal.count === 0) {
    return <span className="text-xs font-normal text-gray-500">{"none"}</span>
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`min-w-[1.5rem] rounded-full px-1.5 py-px text-center font-mono text-xs tabular-nums ${
          active ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
        }`}
      >
        {signal.count}
      </span>
      {signal.proposed > 0 && (
        <span
          className="h-2 w-2 rounded-full bg-yellow-500"
          title={`${signal.proposed} proposed`}
          aria-label={`${signal.proposed} proposed`}
        ></span>
      )}
    </span>
  )
}

export function TrnDetailTabs({
  active,
  portfolioId,
  assetId,
  signals,
}: {
  active: "trades" | "events"
  portfolioId: string | undefined
  assetId: string | undefined
  signals: TrnTabSignals
}): React.ReactElement {
  const router = useRouter()
  const tabs = [
    { id: "trades", label: "Trades", path: "trades", signal: signals.trades },
    { id: "events", label: "Events", path: "events", signal: signals.events },
  ] as const
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex" role="tablist">
          {tabs.map((tab) => {
            const isActive = active === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={isActive ? ACTIVE_TAB : INACTIVE_TAB}
                onClick={() =>
                  router.replace(`/trns/${tab.path}/${portfolioId}/${assetId}`)
                }
              >
                {tab.label}
                <TabCount signal={tab.signal} active={isActive} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TrnDeleteConfirm({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}): React.ReactElement {
  return (
    <ConfirmDialog
      title={"Delete Transaction"}
      message={"Permanently delete this transaction?"}
      confirmLabel={"Delete"}
      cancelLabel={"Cancel"}
      variant="red"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
