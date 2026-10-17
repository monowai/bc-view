import { Asset, AssetOption } from "types/beancounter"

/** Create (or fetch, if it already exists) the BC asset for a search hit. */
export async function createAsset(option: AssetOption): Promise<Asset> {
  if (!option.market || !option.symbol) {
    throw new Error("Cannot resolve this asset — missing market or symbol")
  }
  const code = option.symbol.toUpperCase()
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        [code]: {
          market: option.market,
          code,
          name: option.name || code,
          currency: option.currency,
          category: option.type || "EQUITY",
          owner: "",
        },
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`Could not resolve asset (${response.status})`)
  }
  const body = (await response.json()) as { data: Record<string, Asset> }
  const created = body.data?.[code]
  if (!created?.id) throw new Error("Asset response missing id")
  return created
}
