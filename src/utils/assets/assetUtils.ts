import { Asset } from "@components/types/beancounter";

export function isCashRelated(asset: Asset): boolean {
  return asset.assetCategory.id === "RE" || isCash(asset);
}
export function isCash(asset: Asset): boolean {
  return asset.assetCategory.id === "CASH";
}

export function displayName(asset: Asset): string {
  if (isCash(asset)) {
    return asset.name;
  }
  if (asset.code.indexOf(".") > 0) {
    return `${asset.code.substring(asset.code.indexOf(".") + 1)}: ${
      asset.name
    }`;
  }
  return `${asset.code}: ${asset.name}`;
}
