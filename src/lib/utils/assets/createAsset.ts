import { Asset, AssetOption } from "types/beancounter"
import { toAssetCategoryId } from "@lib/assets/assetUtils"
import { createAssets } from "@utils/api/client/assets"
import { readServerMessage } from "@utils/api/client/request"

/** Create (or fetch, if it already exists) the BC asset for a search hit. */
export async function createAsset(option: AssetOption): Promise<Asset> {
  if (!option.market || !option.symbol) {
    throw new Error("Cannot resolve this asset — missing market or symbol")
  }
  const code = option.symbol.toUpperCase()
  const response = await createAssets({
    data: {
      [code]: {
        market: option.market,
        code,
        name: option.name || code,
        currency: option.currency,
        category: toAssetCategoryId(option.type),
        owner: "",
      },
    },
  })
  if (!response.ok) {
    throw new Error(
      (await readServerMessage(response)) ||
        `Could not resolve asset (${response.status})`,
    )
  }
  const body = (await response.json()) as { data: Record<string, Asset> }
  const created = body.data?.[code]
  if (!created?.id) throw new Error("Asset response missing id")
  return created
}
