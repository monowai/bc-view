import { GroupBy } from "./groupBy";
import { ValuationCcy, ValueIn } from "./constants";

export type TrnType = "BUY" | "SELL" | "DIVI" | "SPLIT";

export interface Market {
  code: string;
  currency: Currency;
}

export interface Currency {
  id: string;
  code: string;
  symbol: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  assetCategory: AssetCategory;
  market: Market;
}

export interface AssetCategory {
  id: string;
  name: string;
}

export interface MoneyValues {
  dividends: number;
  costValue: number;
  fees: number;
  tax: number;
  cash: number; // separate out cash into its own bucket
  purchases: number;
  sales: number;
  costBasis: number;
  averageCost: number;
  realisedGain: number;
  unrealisedGain: number;
  totalGain: number;
  priceData: PriceData;
  marketValue: number;
  currency: Currency;
  valueIn: ValuationCcy;
  weight: number;
}

export interface PriceData {
  change: number;
  close: number;
  previousClose: number;
  changePercent: number;
  priceDate: string;
}

export interface QuantityValues {
  sold: number;
  purchased: number;
  total: number;
  precision: number;
}

export interface Position {
  asset: Asset;
  moneyValues: MoneyValues[];
  quantityValues: QuantityValues;
  dateValues: DateValues;
  lastTradeDate: string;
}

export interface Interface {
  lastDividend: string;
}

export interface GroupedSubtotals {
  groupBy: string;
  subTotals: MoneyValues[];
  valueIn: ValueIn;
}

export interface HoldingValues {
  portfolio: Portfolio;
  groupBy: string;
  holdingGroup: HoldingGroup;
  valueIn: ValueIn;
}

export interface Portfolio {
  id: string;
  code: string;
  name: string;
  currency: Currency;
  base: Currency;
  owner?: SystemUser;
}

export interface PortfolioSummary {
  portfolio: Portfolio;
  moneyValues: MoneyValues[];
  valueIn: ValueIn;
}

export interface PortfolioInput {
  code: string;
  name: string;
  currency: string;
  base: string;
}

// Server side contract
interface HoldingContract {
  portfolio: Portfolio;
  mixedCurrencies: boolean; // Mixed trade currencies?
  asAt: string;
  positions: Position[];
}

interface TransactionImport {
  portfolio: Portfolio;
  purge: boolean;
}

interface HoldingsInCurrency {
  holdings: Holdings;
  valueIn: ValuationCcy;
}

// The payload we render in the UI
interface Holdings {
  holdingGroups: HoldingGroup[];
  portfolio: Portfolio;
  valueIn: ValuationCcy;
  totals: MoneyValues[];
}

interface GroupKey {
  groupKey: string;
}

// User defined grouping
interface HoldingGroup {
  positions: Position[];
  subTotals: MoneyValues[];
}

interface GroupOption {
  label: string;
  value: GroupBy;
}

interface ValuationOption {
  label: string;
  value: ValuationCcy;
}

interface SystemUser {
  active: boolean;
  email: string | undefined;
}

interface TrnInput {
  trnType: TrnType;
  portfolioId: string;
  assetId: string;
  tradeDate: string;
  quantity: number;
  price: number;
  tradeCurrency: string;
  tradeAmount: number;
  tradeBaseRate: number;
  tradePortfolioRate: number;
  cashCurrency: string;
  cashAmount: number;
  tradeCashRate: number;
  fees: number;
  tax: number;
}

interface CallerRef {
  provider: string;
  batch: string;
  callerId: string;
}

interface Transaction {
  id: string;
  callerRef: CallerRef;
  trnType: TrnType;
  portfolio: Portfolio;
  asset: Asset;
  tradeDate: string;
  quantity: number;
  price: number;
  tradeCurrency: Currency;
  tradeAmount: number;
  tradeBaseRate: number;
  tradePortfolioRate: number;
  cashCurrency: string;
  cashAmount: number;
  tradeCashRate: number;
  fees: number;
  comments: string;
}
