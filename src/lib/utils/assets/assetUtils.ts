import { Asset } from "types/beancounter"

export function isCashRelated(asset: Asset): boolean {
  return asset.assetCategory.id === "RE" || isCash(asset) || isAccount(asset)
}
export function isCash(asset: Asset): boolean {
  return asset.assetCategory.id === "CASH"
}

export function isAccount(asset: Asset): boolean {
  return asset.assetCategory.id === "ACCOUNT"
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

export function displayName(asset: Asset): string {
  if (isCash(asset)) {
    return asset.name
  }
  const displayCode = getDisplayCode(asset)
  return `${displayCode}: ${asset.name}`
}
