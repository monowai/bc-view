import { Portfolio } from "./beancounter";
import { AxiosError } from "axios";

interface TransactionUpload {
  portfolio: Portfolio;
  row: string[];
}

interface Loading {
  message: string;
  show: boolean;
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

interface BcResult<T> {
  data: T | any;
  error: AxiosError | any;
}

export interface DevMessage {
  debug: boolean;
  errorMessage: string;
  token: string | undefined;
}
