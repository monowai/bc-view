import { Portfolio } from "./beancounter";
import { GroupBy, ValueIn } from "@types/constants";

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

export interface HoldingDefaults {
  toggleHideEmpty(): void;
  readonly valueIn: ValuationOption;
  readonly groupBy: GroupOption;
  setValueIn(value: ValuationOption): void;
  readonly hideEmpty: boolean;
  setGroupBy(value: GroupOption): void;
  // groupOptions: GroupOption[];
}
