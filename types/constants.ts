// Runtime constants - these are exported as values (not just types)
// Note: .d.ts files can only export types, so runtime values go here

// Centralized ValueIn options - the currency perspective for viewing values
export const VALUE_IN_OPTIONS = {
  PORTFOLIO: "PORTFOLIO",
  BASE: "BASE",
  TRADE: "TRADE",
} as const

export type ValueInOption =
  (typeof VALUE_IN_OPTIONS)[keyof typeof VALUE_IN_OPTIONS]

// Backend GroupBy enum values (what gets persisted)
export const GROUP_BY_API_VALUES = {
  ASSET_CLASS: "ASSET_CLASS",
  SECTOR: "SECTOR",
  MARKET_CURRENCY: "MARKET_CURRENCY",
  MARKET: "MARKET",
} as const

export type GroupByApiValue =
  (typeof GROUP_BY_API_VALUES)[keyof typeof GROUP_BY_API_VALUES]

// Frontend GroupBy property paths (used for client-side grouping)
export const GROUP_BY_PROPERTY_PATHS = {
  ASSET_CLASS: "asset.assetCategory.name",
  SECTOR: "asset.sector",
  MARKET_CURRENCY: "asset.market.currency.code",
  MARKET: "asset.market.code",
} as const

export type GroupByPropertyPath =
  (typeof GROUP_BY_PROPERTY_PATHS)[keyof typeof GROUP_BY_PROPERTY_PATHS]

// Mapping from API value to property path
export function apiValueToPropertyPath(
  apiValue: GroupByApiValue,
): GroupByPropertyPath {
  return GROUP_BY_PROPERTY_PATHS[apiValue]
}

// Mapping from property path to API value
export function propertyPathToApiValue(
  propertyPath: GroupByPropertyPath,
): GroupByApiValue {
  const entries = Object.entries(GROUP_BY_PROPERTY_PATHS) as [
    keyof typeof GROUP_BY_PROPERTY_PATHS,
    GroupByPropertyPath,
  ][]
  const found = entries.find(([, path]) => path === propertyPath)
  return found ? GROUP_BY_API_VALUES[found[0]] : GROUP_BY_API_VALUES.ASSET_CLASS
}

// Legacy export for backward compatibility with existing code
// GROUP_BY_OPTIONS uses property paths (for client-side grouping)
export const GROUP_BY_OPTIONS = GROUP_BY_PROPERTY_PATHS

export type GroupByOption = GroupByPropertyPath
