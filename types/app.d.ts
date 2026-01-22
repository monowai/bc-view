import { Market, Portfolio, TrnInput } from "./beancounter"

interface TransactionUpload {
  portfolio: Portfolio
  row: string[]
  token?: string
}

interface FormatNumber {
  value
  scale?: number
  multiplier?: number
  defaultValue?: string
  isPublic?: boolean // If true, value is not hidden in privacy mode (e.g., percentages)
}

export interface DelimitedImport {
  hasHeader: boolean
  portfolio: Portfolio
  purge: boolean
  results: string[]
  token: string | undefined
}

export interface ValuationOption {
  label: string
  value: ValueIn
}

export interface ValuationOptions {
  valuationDefault: ValuationOption
  values: ValuationOption[]
}

export interface GroupOptions {
  groupDefault: GroupOption
  values: GroupOption[]
}

export interface GroupOption {
  label: string
  value: GroupBy
}

export type DisplayCurrencyMode = "PORTFOLIO" | "BASE" | "TRADE" | "CUSTOM"

export interface DisplayCurrencyOption {
  mode: DisplayCurrencyMode
  customCode?: string // Only used when mode is "CUSTOM"
}

export interface TradeDefaults {
  readonly onMarket: boolean
  setOffMarket(value: boolean)
  readonly market: Market
  setMarket(market: Market): void
  readonly trnInput: TrnInput
  setTrnInput(value: TrnInput): void
}
export interface HoldingDefaults {
  toggleHideEmpty(): void
  readonly valueIn: ValuationOption
  readonly groupBy: GroupOption
  setValueIn(value: ValuationOption): void
  readonly hideEmpty: boolean
  setGroupBy(value: GroupOption): void
  setAsAt(value: string): void
  readonly asAt: string
  readonly displayCurrency: DisplayCurrencyOption
  setDisplayCurrency(value: DisplayCurrencyOption): void
  /**
   * True when Cost/Gains are approximate due to FX conversion.
   * This happens when Display Currency differs from the Value In bucket.
   */
  readonly isCostApproximate: boolean
  readonly hasInitialized: boolean
  setHasInitialized(value: boolean): void
  readonly viewMode: "summary" | "table" | "cards" | "heatmap" | "income"
  setViewMode(value: "summary" | "table" | "cards" | "heatmap" | "income"): void
}
