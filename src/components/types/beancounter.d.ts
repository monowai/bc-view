
export type TrnType = "BUY" | "SELL" | "DIVI" | "SPLIT";

export interface Market {
  code: string;
  currency: Currency;
}

export interface Currency {
  code: string;
  name: string;
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
  [index: ValueIn]: MoneyValues;

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
  gainOnDay: number;
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
  [index: string]: any; // ToDo this shouldn't use any
  asset: Asset;
  moneyValues: MoneyValues[ValueIn];
  quantityValues: QuantityValues;
  dateValues: DateValues;
  lastTradeDate: string;
}

export interface GroupedSubtotals {
  groupBy: string;
  subTotals: MoneyValues[ValueIn];
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

export interface PortfolioResponse {
  data: Portfolio;
}

export interface PortfolioResponses {
  data: Portfolio[];
}

export interface PortfolioRequest {
  code: string;
  name: string;
  currency: string;
  base: string;
}
export interface PortfolioRequests {
  data: PortfolioRequest[];
}
export interface PortfolioSummary {
  moneyValues: MoneyValues[ValueIn];
  valueIn: ValueIn;
}

export interface PortfolioInput {
  code: string;
  name: string;
  currency: CurrencyOption;
  base: CurrencyOption;
}

export interface CurrencyOption {
  label: string;
  value: string;
}

// Server side contract
interface HoldingContract {
  portfolio: Portfolio;
  isMixedCurrencies: boolean; // Mixed trade currencies?
  asAt: string;
  positions: Position[string];
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
  holdingGroups: HoldingGroup[string];
  portfolio: Portfolio;
  valueIn: ValuationCcy;
  totals: MoneyValues[ValueIn];
}

interface GroupKey {
  groupKey: string;
}

// User defined grouping
interface HoldingGroup {
  positions: Position[];
  subTotals: MoneyValues[ValueIn];
}

interface SystemUser {
  id: string;
  active: boolean;
  email: string | undefined;
  since: string;
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
  tax: number;
  comments: string;
}

interface Registration {
  id: string;
  email: string;
  active: boolean;
  since: string;
}

export interface RegistrationResponse {
  data: Registration;
}
