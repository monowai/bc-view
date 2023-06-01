import { Asset } from "@core/types/beancounter";

export function isCashRelated(asset: Asset): boolean {
  return asset.assetCategory.id === "RE" || isCash(asset);
}
export function isCash(asset: Asset): boolean {
  return asset.assetCategory.id === "CASH";
}

export function assetName(asset: Asset): string {
  if (isCash(asset)) {
    return asset.name;
  }
  return `${asset.code}: ${asset.name}`;
}
