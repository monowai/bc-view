import {
  Asset,
  AssetHolding,
  Currency,
  NewsArticle,
  SectorExposure,
  SubAccountRequest,
} from "types/beancounter"

export const USD: Currency = { code: "USD", name: "US Dollar", symbol: "$" }
export const SGD: Currency = {
  code: "SGD",
  name: "Singapore Dollar",
  symbol: "S$",
}
export const NZD: Currency = {
  code: "NZD",
  name: "New Zealand Dollar",
  symbol: "NZ$",
}

export function makeCurrency(overrides: Partial<Currency> = {}): Currency {
  return { ...USD, ...overrides }
}

/**
 * A listed equity. The read-only traits svc-data sends default to a public,
 * priced asset; `displayCode` follows an overridden `code` unless given, so a
 * private (owner-prefixed) code must pass its own `displayCode` and flags.
 */
export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  // svc-data sends cashLike for currency cash and bank accounts.
  const category = overrides.assetCategory?.id?.toUpperCase()
  return {
    id: "asset-aapl",
    code: "AAPL",
    name: "Apple Inc.",
    assetCategory: { id: "equity", name: "Equity" },
    market: { code: "NASDAQ", name: "NASDAQ", currency: USD },
    chartable: true,
    watchable: true,
    hasNews: true,
    displayCode: overrides.code ?? "AAPL",
    cashLike: category === "CASH" || category === "ACCOUNT",
    ...overrides,
  } as Asset
}

export function makeCashAsset(currency: Currency = USD): Asset {
  return makeAsset({
    id: `cash-${currency.code.toLowerCase()}`,
    code: currency.code,
    name: `${currency.name} Cash`,
    assetCategory: { id: "CASH", name: "Cash" },
    market: { code: "CASH", name: "Cash", currency },
    chartable: false,
    watchable: false,
    hasNews: false,
  })
}

export function makeSectorExposure(
  overrides: Partial<SectorExposure> = {},
): SectorExposure {
  return {
    item: { name: "Information Technology", code: "INFORMATION_TECHNOLOGY" },
    weight: 0.372,
    asOf: "2026-08-04",
    ...overrides,
  }
}

export function makeAssetHolding(
  overrides: Partial<AssetHolding> = {},
): AssetHolding {
  return {
    symbol: "AAPL",
    name: "Apple Inc.",
    weight: 0.072,
    asOf: "2026-08-04",
    ...overrides,
  }
}

export function makeSubAccount(
  overrides: Partial<SubAccountRequest> = {},
): SubAccountRequest {
  return {
    code: "OA",
    displayName: "Ordinary Account",
    balance: 0,
    liquid: true,
    ...overrides,
  }
}

export function makeNewsArticle(
  overrides: Partial<NewsArticle> = {},
): NewsArticle {
  return {
    title: "Headline",
    summary: "Summary.",
    source: "https://news.example.com/a",
    timePublished: "2026-09-30T12:00:00",
    sentimentLabel: "Neutral",
    sentimentScore: 0,
    ...overrides,
  }
}
