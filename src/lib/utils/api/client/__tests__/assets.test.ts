import {
  assetBrokersKey,
  assetConfigKey,
  assetConfigsKey,
  assetKey,
  assetPositionsKey,
  assetResolveKey,
  assetSearchUrl,
  assetValuesKey,
  assetsKey,
  accountsKey,
  deleteAsset,
  marketAssetsKey,
  resolveCashAssetId,
  saveAssetConfig,
  tradeAccountsKey,
} from "@utils/api/client/assets"

describe("assets api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(assetsKey).toBe("/api/assets")
    expect(accountsKey).toBe("/api/assets?category=ACCOUNT")
    expect(tradeAccountsKey).toBe("/api/assets?category=TRADE")
    expect(assetKey("a1")).toBe("/api/assets/a1")
    expect(assetConfigsKey).toBe("/api/assets/config")
    expect(assetConfigKey("a1")).toBe("/api/assets/config/a1")
    expect(assetPositionsKey("a1")).toBe("/api/assets/a1/positions?date=today")
    expect(assetBrokersKey("a1")).toBe("/api/assets/a1/brokers")
    expect(assetValuesKey()).toBe("/api/assets/values")
    expect(assetValuesKey("S D")).toBe("/api/assets/values?currency=S%20D")
    expect(marketAssetsKey("INDEX")).toBe("/api/assets/market/INDEX")
    expect(assetResolveKey("code=X")).toBe("/api/assets/resolve?code=X")
    expect(assetSearchUrl(new URLSearchParams({ keyword: "a b" }))).toBe(
      "/api/assets/search?keyword=a+b",
    )
  })
})

describe("assets api requests", () => {
  afterEach(() => jest.restoreAllMocks())

  it("posts a config as JSON", async () => {
    const res = { ok: true } as Response
    const fetchMock = jest.fn().mockResolvedValue(res)
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(saveAssetConfig("a1", { isPension: true })).resolves.toBe(res)
    expect(fetchMock).toHaveBeenCalledWith("/api/assets/config/a1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"isPension":true}',
    })
  })

  it("deletes without a body or headers", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch

    await deleteAsset("a1")
    expect(fetchMock).toHaveBeenCalledWith("/api/assets/a1", {
      method: "DELETE",
    })
  })

  it("resolves a cash asset id", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "cash-usd" } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(resolveCashAssetId("USD")).resolves.toBe("cash-usd")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/assets/resolve?market=CASH&code=USD",
    )
  })

  it("throws when the cash asset cannot be resolved", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch

    await expect(resolveCashAssetId("XYZ")).rejects.toThrow(
      "Failed to resolve cash asset: XYZ",
    )
  })
})
