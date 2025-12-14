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

export function displayName(asset: Asset): string {
  if (isCash(asset)) {
    return asset.name
  }
  if (asset.code.indexOf(".") > 0) {
    return `${asset.code.substring(asset.code.indexOf(".") + 1)}: ${asset.name}`
  }
  return `${asset.code}: ${asset.name}`
}
