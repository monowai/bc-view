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
  hideEmpty: boolean;
  valueIn: ValuationOption;
  groupBy: GroupOption;
}
