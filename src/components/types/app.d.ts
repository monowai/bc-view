import { Market, Portfolio, TrnInput } from "./beancounter";

interface TransactionUpload {
  portfolio: Portfolio;
  row: string[];
}

interface FormatNumber {
  value;
  scale?: number;
  multiplier?: number;
  defaultValue?: string;
}

export interface DelimitedImport {
  hasHeader: boolean;
  portfolio: Portfolio;
  purge: boolean;
  results: string[];
  token: string | undefined;
}

export interface ValuationOption {
  label: string;
  value: ValueIn;
}

export interface ValuationOptions {
  valuationDefault: ValuationOption;
  values: ValuationOption[];
}

export interface GroupOptions {
  groupDefault: GroupOption;
  values: GroupOption[];
}

export interface GroupOption {
  label: string;
  value: GroupBy;
}

export interface TradeDefaults {
  readonly onMarket: boolean;
  setOffMarket(value: boolean);
  readonly market: Market;
  setMarket(market: Market): void;
  readonly trnInput: TrnInput;
  setTrnInput(value: TrnInput): void;
}
export interface HoldingDefaults {
  toggleHideEmpty(): void;
  readonly valueIn: ValuationOption;
  readonly groupBy: GroupOption;
  setValueIn(value: ValuationOption): void;
  readonly hideEmpty: boolean;
  setGroupBy(value: GroupOption): void;
  setAsAt(value: string): void;
  readonly asAt: string;
}
