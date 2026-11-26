import React from "react"
import { Control, Controller, FieldValues, Path } from "react-hook-form"
import { NumericFormat } from "react-number-format"
import { BrokerWithAccounts, Portfolio } from "types/beancounter"
import TradeStatusToggle from "@components/features/transactions/TradeStatusToggle"
import { AssetOption, groupAssetOptions } from "@lib/trns/cashFormHelpers"
import { TradeColorScheme } from "@lib/trns/tradeUtils"
import { formatFxRate } from "@lib/formatters"

/** A money figure, two decimals, thousands separated. */
export function Money({ value }: { value: number }): React.ReactElement {
  return (
    <NumericFormat
      value={value}
      displayType="text"
      thousandSeparator
      decimalScale={2}
      fixedDecimalScale
    />
  )
}

/**
 * The transaction read back beside the buttons: what it does, how much, and
 * in what. `children` adds the working (shares @ price, weight).
 */
export function TrnSummary({
  label,
  amount,
  currency,
  scheme,
  testId = "trn-summary",
  children,
}: {
  label: string
  amount: number
  currency?: string
  scheme: TradeColorScheme
  testId?: string
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5"
    >
      <span
        data-testid={`${testId}-type`}
        className={`text-xs font-semibold ${scheme.text}`}
      >
        {label}
      </span>
      <span
        data-testid={`${testId}-amount`}
        className="font-mono text-sm font-semibold tabular-nums text-gray-900"
      >
        <Money value={amount} />
      </span>
      {currency && <span className="text-xs text-gray-500">{currency}</span>}
      {children}
    </div>
  )
}

/** An exchange read back beside the buttons: what leaves, what arrives. */
export function FxSummary({
  sellAmount,
  sellLabel,
  buyAmount,
  buyLabel,
}: {
  sellAmount: number
  sellLabel: string
  buyAmount: number
  buyLabel: string
}): React.ReactElement {
  return (
    <div
      data-testid="fx-summary"
      className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-gray-500"
    >
      <span className="font-mono text-sm font-semibold tabular-nums text-gray-900">
        {sellAmount > 0 ? <Money value={sellAmount} /> : "—"}
      </span>
      <span className="truncate" title={sellLabel}>
        {sellLabel}
      </span>
      <i className="fas fa-arrow-right px-1 text-gray-400" aria-label="to"></i>
      <span className="font-mono text-sm font-semibold tabular-nums text-gray-900">
        {buyAmount > 0 ? <Money value={buyAmount} /> : "—"}
      </span>
      <span className="truncate" title={buyLabel}>
        {buyLabel}
      </span>
    </div>
  )
}

/**
 * Under the buy amount: which rate it was struck at, and a way back to the
 * market rate once the user has typed their own amount.
 */
export function FxRateHint({
  marketRate,
  impliedRate,
  manual,
  loading,
  failed,
  onUseMarketRate,
}: {
  marketRate: number | null
  impliedRate: number | null
  manual: boolean
  loading: boolean
  /** The rate lookup failed, so the amount has to be typed. */
  failed: boolean
  onUseMarketRate: () => void
}): React.ReactElement | null {
  const rate = formatFxRate
  let text: React.ReactNode = null
  if (loading) text = "Fetching the market rate…"
  else if (failed && !manual)
    text = "Market rate unavailable. Enter the amount received."
  else if (manual && impliedRate)
    text = (
      <>
        Your rate <span className="font-mono">{rate(impliedRate)}</span>
        {marketRate && (
          <>
            {" · market "}
            <span className="font-mono">{rate(marketRate)}</span>
          </>
        )}
      </>
    )
  else if (marketRate)
    text = (
      <>
        At the market rate <span className="font-mono">{rate(marketRate)}</span>
      </>
    )
  if (!text) return null
  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
      <span>{text}</span>
      {manual && marketRate && (
        <button
          type="button"
          onClick={onUseMarketRate}
          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          Use market rate
        </button>
      )}
    </p>
  )
}

/** A select of currencies and accounts, grouped by kind. */
export function CashAccountSelect({
  id,
  value,
  options,
  onChange,
  className,
}: {
  id?: string
  value: string
  options: AssetOption[]
  onChange: (option: AssetOption) => void
  className: string
}): React.ReactElement {
  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => {
        const selected = options.find((opt) => opt.value === e.target.value)
        if (selected) onChange(selected)
      }}
    >
      {groupAssetOptions(options).map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/**
 * One choice from a short list, all options on show. Native radios, so the
 * arrow keys move between them.
 */
export function SegmentedChoice<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
}: {
  name: string
  legend: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}): React.ReactElement {
  return (
    <fieldset className="pb-3">
      <legend className="sr-only">{legend}</legend>
      <div className="flex rounded-lg bg-gray-100 p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 has-checked:bg-white has-checked:text-gray-900 has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-blue-600"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** The Proposed/Settled switch, bound to a `status` field. */
export function TrnStatusField<T extends FieldValues>({
  control,
}: {
  control: Control<T, any, any>
}): React.ReactElement {
  return (
    <Controller
      name={"status" as Path<T>}
      control={control}
      render={({ field }) => (
        <TradeStatusToggle
          isSettled={field.value?.value === "SETTLED"}
          onChange={(isSettled) => {
            const status = isSettled ? "SETTLED" : "PROPOSED"
            field.onChange({ value: status, label: status })
          }}
          size="sm"
        />
      )}
    />
  )
}

/** Where a trade executes, bound to a `brokerId` field. */
export function BrokerAccountField<T extends FieldValues>({
  id,
  control,
  brokers,
  labelClassName,
  inputClassName,
}: {
  id: string
  control: Control<T, any, any>
  brokers: BrokerWithAccounts[]
  labelClassName: string
  inputClassName: string
}): React.ReactElement {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClassName}>
          {"Brokerage account"}
        </label>
        <a
          href="/brokers"
          target="_blank"
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          {"Manage"}
        </a>
      </div>
      <Controller
        name={"brokerId" as Path<T>}
        control={control}
        render={({ field }) => (
          <select
            id={id}
            className={inputClassName}
            value={field.value || ""}
            onChange={(e) => field.onChange(e.target.value)}
          >
            <option value="">{"-- No account --"}</option>
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.name}
                {broker.accountNumber ? ` (${broker.accountNumber})` : ""}
              </option>
            ))}
          </select>
        )}
      />
    </div>
  )
}

/**
 * The portfolio a transaction lands in, chosen on the context line under the
 * title. A note says when it differs from where the form was opened.
 */
export function PortfolioSwitch({
  portfolios,
  value,
  onChange,
  changedNote,
}: {
  portfolios: Portfolio[]
  value: string
  onChange: (portfolioId: string) => void
  /** Shown when the choice differs from the portfolio the form opened on. */
  changedNote?: string
}): React.ReactElement {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <select
        aria-label="Portfolio"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 max-w-full truncate rounded-md py-0.5 pl-1.5 pr-1 text-xs hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${changedNote ? "bg-amber-50 text-amber-800" : "text-gray-600"}`}
      >
        {portfolios.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </select>
      {changedNote && (
        <span className="shrink-0 text-xs text-amber-700">{changedNote}</span>
      )}
    </span>
  )
}
