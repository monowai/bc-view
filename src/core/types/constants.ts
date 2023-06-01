// Enums can't be exported from types in time to compilation to resolve

export enum GroupBy {
  MARKET_CURRENCY = "asset.market.currency.code",
  MARKET = "asset.market.code",
  ASSET_CLASS = "asset.assetCategory.name",
}

// Enum is pointer to a collection of values that index the holding contract
export enum ValueIn {
  PORTFOLIO = "PORTFOLIO",
  BASE = "BASE",
  TRADE = "TRADE",
}
