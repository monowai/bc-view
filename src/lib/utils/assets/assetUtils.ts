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

// Fund-like assets carry pooled sector/holdings exposure data from the
// classification provider. Both ETFs and (non-US) mutual funds — e.g.
// LSE/LON-listed UCITS funds, which the backend categorises MUTUAL FUND
// rather than ETF — can surface a "View Sectors" action.
// Optional-chained deliberately: the type declares assetCategory as required, but
// positions arriving from svc-position have been observed without it, which is why
// call sites across the app defensively use `assetCategory?.id`. This helper replaces
// one of those, so it must not be the thing that starts throwing.
export function isFundLike(asset: Asset): boolean {
  const category = asset.assetCategory?.id
  return category === "ETF" || category === "MUTUAL FUND"
}

// Assets with constant price of 1 - don't require external market data pricing
export function isConstantPrice(asset: Asset): boolean {
  return isCash(asset) || isAccount(asset) || isPolicy(asset)
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
 * The code a user reads, as svc-data sends it (`asset.displayCode`: a private
 * owner prefix dropped, a public dotted ticker left whole). Null-safe.
 */
export function getDisplayCode(asset: Asset | null | undefined): string {
  return asset?.displayCode ?? ""
}

/**
 * Strip the owner prefix from a raw code string. See [getDisplayCode] for
 * the contract — same heuristic; public dotted tickers are left intact.
 */
export function stripOwnerPrefix(code: string): string {
  if (!code) return ""
  return dropOwnerPrefix(code)
}

export interface FxPairLegs {
  from: string
  to: string
}

const FX_PAIR_CODE = /^[A-Z]{6}$/

/**
 * The base and quote currencies of a currency-pair asset — `NZDSGD` on the
 * FX market is SGD per NZD, so `{ from: "NZD", to: "SGD" }`. Null for any
 * asset that is not a six-letter pair on the FX market.
 */
export function fxPairLegs(
  asset: Pick<Asset, "code" | "market"> | null | undefined,
): FxPairLegs | null {
  if (asset?.market?.code?.toUpperCase() !== "FX") return null
  const code = dropOwnerPrefix(asset.code || "").toUpperCase()
  if (!FX_PAIR_CODE.test(code)) return null
  return { from: code.slice(0, 3), to: code.slice(3) }
}

/**
 * Whether a BUY/SELL trade of the asset makes sense: holdings' rule (no cash,
 * account or real estate), plus currency pairs — a pair is a rate to watch;
 * exchanging currency is an FX_BUY in the cash form, not a BUY of the pair.
 */
export function isTradeable(asset: Asset): boolean {
  return !isNonTradeable(asset) && !fxPairLegs(asset)
}

/**
 * Decimal places for an asset's price and price-derived figures: 4 for a
 * currency (category CURRENCY or a pair on the FX market), where 2 would
 * round a 0.7254 rate to 0.73; 2 for everything else.
 */
export function priceDecimals(
  asset: Pick<Asset, "code" | "market" | "assetCategory"> | null | undefined,
): number {
  if (!asset) return 2
  const currency = asset.assetCategory?.id === "CURRENCY" || !!fxPairLegs(asset)
  return currency ? 4 : 2
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
  return isCash(asset) ? asset.name : asset.displayCode
}

/**
 * Canonical href for a position's trade history.
 */
export function buildTradesHref(portfolioId: string, assetId: string): string {
  return `/trns/trades/${portfolioId}/${assetId}`
}

/**
 * Whether an asset can go on a watchlist, for an option built from a bare
 * code and market (no server traits). An `Asset` or search hit carries
 * `watchable` from svc-data; read that instead. Private assets have no market
 * price to track.
 */
export function isWatchable(asset: {
  market?: { code?: string } | string
}): boolean {
  const code =
    typeof asset.market === "string" ? asset.market : asset.market?.code
  return code !== "PRIVATE"
}

/**
 * BC category id for a search hit's type. Providers send their own casing
 * ("Mutual Fund"); BC category ids are upper case. Defaults to EQUITY.
 */
export function toAssetCategoryId(type: string | undefined): string {
  return (type || "EQUITY").toUpperCase()
}

/**
 * Href for the Asset Lookup page focused on one asset — the same query shape
 * the header search pushes, so the page hydrates without searching again.
 */
export function buildAssetLookupHref(asset: Asset): string {
  const params = new URLSearchParams({
    symbol: getDisplayCode(asset),
    assetId: asset.id,
  })
  if (asset.market?.code) params.set("market", asset.market.code)
  if (asset.name) params.set("name", asset.name)
  const currency = getAssetCurrency(asset)
  if (currency) params.set("currency", currency)
  // The lookup page maps `type` to the category, which gates e.g. Sectors.
  if (asset.assetCategory?.id) params.set("type", asset.assetCategory.id)
  return `/assets/lookup?${params.toString()}`
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
 * Shape consumed by NewsSentimentPopup and AssetReviewPopup. Centralized so
 * every view builds it the same way.
 */
export function buildNewsAsset(asset: Asset): NewsAssetRef {
  return {
    ticker: asset.displayCode,
    market: asset.market.code,
    assetName: asset.name || "",
  }
}
