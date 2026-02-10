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

/**
 * Get the display code for an asset, stripping any owner prefix.
 * Private/custom assets often have codes like "userId.SCB-SGD" - this returns just "SCB-SGD".
 */
export function getDisplayCode(asset: Asset | null | undefined): string {
  if (!asset) return ""
  const code = asset.code || ""
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
}

/**
 * Get the display code from a raw code string, stripping any owner prefix.
 */
export function stripOwnerPrefix(code: string): string {
  if (!code) return ""
  const dotIndex = code.lastIndexOf(".")
  return dotIndex >= 0 ? code.substring(dotIndex + 1) : code
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
