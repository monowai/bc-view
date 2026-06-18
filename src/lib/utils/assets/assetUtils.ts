import { Asset } from "types/beancounter"

/**
 * Canonical way to get an asset's currency code.
 * Checks accountingType (V11+), then priceSymbol (legacy), then market currency.
 */
export function getAssetCurrency(asset: {
  accountingType?: { currency?: { code?: string } }
  priceSymbol?: string
  market?: { currency?: { code?: string } }
}): string {
  return (
    asset.accountingType?.currency?.code ||
    asset.priceSymbol ||
    asset.market?.currency?.code ||
    ""
  )
}

export function isCashRelated(asset: Asset): boolean {
  return isCash(asset) || isAccount(asset)
}

export function isNonTradeable(asset: Asset): boolean {
  return asset.assetCategory.id === "RE" || isCash(asset) || isAccount(asset)
}
export function isCash(asset: Asset): boolean {
  return asset.assetCategory.id === "CASH"
}

export function isAccount(asset: Asset): boolean {
  return asset.assetCategory.id === "ACCOUNT"
}

export function isPolicy(asset: Asset): boolean {
  return asset.assetCategory.id === "POLICY"
}

// Assets with constant price of 1 - don't require external market data pricing
export function isConstantPrice(asset: Asset): boolean {
  return isCash(asset) || isAccount(asset) || isPolicy(asset)
}

// Check if asset supports balance setting (CASH currencies or ACCOUNT bank accounts)
export function supportsBalanceSetting(asset: Asset): boolean {
  return isCash(asset) || isAccount(asset)
}

// Owner-prefix detection. Private-asset codes are stored as `${userId}.${CODE}`
// where the userId is a base64-encoded UUID (22 chars). Public dotted tickers
// (BRK.B, RDS.A, JK.M, etc.) have short prefixes (≤5 chars). A length threshold
// cleanly separates the two without needing the caller to pass marketCode.
const OWNER_PREFIX_MIN_LENGTH = 12

function dropOwnerPrefix(code: string): string {
  // Split on the FIRST dot — the owner prefix is the userId, and the asset
  // code itself may carry further dots (BRK.B, RDS.A). lastIndexOf would
  // amputate the class indicator from a private dotted asset.
  const dotIndex = code.indexOf(".")
  if (dotIndex < 0) return code
  const prefix = code.substring(0, dotIndex)
  return prefix.length >= OWNER_PREFIX_MIN_LENGTH
    ? code.substring(dotIndex + 1)
    : code
}

/**
 * Get the display code for an asset. Strips the owner prefix from PRIVATE-style
 * codes (e.g. `${userId}.SCB-SGD` → `SCB-SGD`) while preserving public dotted
 * tickers (`BRK.B` stays `BRK.B`).
 */
export function getDisplayCode(asset: Asset | null | undefined): string {
  if (!asset) return ""
  return dropOwnerPrefix(asset.code || "")
}

/**
 * Strip the owner prefix from a raw code string. See [getDisplayCode] for
 * the contract — same heuristic; public dotted tickers are left intact.
 */
export function stripOwnerPrefix(code: string): string {
  if (!code) return ""
  return dropOwnerPrefix(code)
}

/**
 * Resolve an asset ID that may be a synthetic "cash:CURRENCY" reference
 * to a real asset UUID via the backend. Real UUIDs pass through unchanged.
 */
export async function resolveAssetId(assetId: string): Promise<string> {
  if (!assetId.startsWith("cash:")) {
    return assetId
  }
  const currencyCode = assetId.substring(5)
  const response = await fetch(
    `/api/assets/resolve?market=CASH&code=${currencyCode}`,
  )
  if (!response.ok) {
    throw new Error(`Failed to resolve cash asset: ${currencyCode}`)
  }
  const data = await response.json()
  return data.data.id
}

export function displayName(asset: Asset): string {
  if (isCash(asset)) {
    return asset.name
  }
  const displayCode = getDisplayCode(asset)
  return `${displayCode}: ${asset.name}`
}

/**
 * Title displayed on a holding card / row: cash uses asset.name, everything
 * else uses the owner-prefix-stripped ticker. Pulled out of CardView/Rows so
 * both views can't drift.
 */
export function getPositionDisplayName(asset: Asset): string {
  return isCash(asset) ? asset.name : stripOwnerPrefix(asset.code)
}

/**
 * Canonical href for a position's trade history.
 */
export function buildTradesHref(portfolioId: string, assetId: string): string {
  return `/trns/trades/${portfolioId}/${assetId}`
}

/**
 * Href for an asset's trade history across multiple portfolios — used by the
 * aggregated holdings drill-down. The trades page switches to portfolio-grouped
 * mode when the `portfolios` query param is present.
 */
export function buildAggregatedTradesHref(
  assetId: string,
  portfolioIds: string[],
): string {
  return `/trns/trades/${assetId}?portfolios=${portfolioIds.join(",")}`
}

export interface NewsAssetRef {
  ticker: string
  market: string
  assetName: string
}

/**
 * Shape consumed by NewsSentimentPopup. Centralized so card / row build it
 * the same way.
 */
export function buildNewsAsset(asset: Asset): NewsAssetRef {
  return {
    ticker: stripOwnerPrefix(asset.code),
    market: asset.market.code,
    assetName: asset.name || "",
  }
}
