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

export interface GroupOption {
  label: string;
  value: GroupBy;
}

export interface HoldingDefaults {
  toggleHideEmpty(): void;
  readonly valueIn: ValuationOption;
  setValueIn(value: ValuationOption): void;
  readonly hideEmpty: boolean;
  readonly groupBy: GroupOption;
  setGroupBy(value: GroupOption): void;
}
