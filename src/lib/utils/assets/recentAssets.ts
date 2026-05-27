import { AssetOption } from "types/beancounter"
import { getLocalValue, setLocalValue } from "@lib/storage/localState"

const STORAGE_KEY = "asset-recent-searches"
const MAX_RECENTS = 8

const identityOf = (option: AssetOption): string =>
  option.assetId || `${option.market || ""}:${option.symbol}`

export function getRecentAssets(): AssetOption[] {
  return getLocalValue<AssetOption[]>(STORAGE_KEY, [])
}

export function pushRecentAsset(option: AssetOption): AssetOption[] {
  const id = identityOf(option)
  const filtered = getRecentAssets().filter((o) => identityOf(o) !== id)
  const next = [option, ...filtered].slice(0, MAX_RECENTS)
  setLocalValue(STORAGE_KEY, next)
  return next
}
