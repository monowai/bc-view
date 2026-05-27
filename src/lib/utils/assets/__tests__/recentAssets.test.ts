import { AssetOption } from "types/beancounter"
import { getRecentAssets, pushRecentAsset } from "@lib/assets/recentAssets"

const makeOption = (id: string, symbol: string = id): AssetOption => ({
  value: id,
  label: `${symbol} - ${id}`,
  symbol,
  assetId: id,
  market: "NASDAQ",
})

describe("recentAssets", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("returns empty list when storage is empty", () => {
    expect(getRecentAssets()).toEqual([])
  })

  it("pushes newest first and persists", () => {
    pushRecentAsset(makeOption("A"))
    pushRecentAsset(makeOption("B"))
    const recents = getRecentAssets()
    expect(recents.map((r) => r.assetId)).toEqual(["B", "A"])
  })

  it("dedupes by assetId, moving the existing entry to the front", () => {
    pushRecentAsset(makeOption("A"))
    pushRecentAsset(makeOption("B"))
    pushRecentAsset(makeOption("A"))
    expect(getRecentAssets().map((r) => r.assetId)).toEqual(["A", "B"])
  })

  it("dedupes by market:symbol when assetId is absent", () => {
    const noId = (sym: string): AssetOption => ({
      value: sym,
      label: sym,
      symbol: sym,
      market: "NYSE",
    })
    pushRecentAsset(noId("FOO"))
    pushRecentAsset(noId("BAR"))
    pushRecentAsset(noId("FOO"))
    expect(getRecentAssets().map((r) => r.symbol)).toEqual(["FOO", "BAR"])
  })

  it("caps at 8 entries", () => {
    for (let i = 0; i < 12; i++) {
      pushRecentAsset(makeOption(`A${i}`))
    }
    const recents = getRecentAssets()
    expect(recents).toHaveLength(8)
    expect(recents[0].assetId).toBe("A11")
    expect(recents[7].assetId).toBe("A4")
  })
})
