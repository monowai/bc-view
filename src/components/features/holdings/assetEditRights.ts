import type { Asset } from "types/beancounter"

/**
 * Who may edit an asset. A PRIVATE asset belongs to the user who created it, so they edit it
 * themselves; a public asset is shared by everyone, so only an administrator may. Matches what
 * svc-data accepts, so the menu never offers an edit the server would refuse.
 */
export function canEditAsset(
  asset: Pick<Asset, "market">,
  isAdmin: boolean,
): boolean {
  return asset.market?.code === "PRIVATE" || isAdmin
}
