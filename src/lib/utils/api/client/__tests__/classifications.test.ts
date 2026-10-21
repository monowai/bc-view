import {
  assetClassificationKey,
  assetExposuresKey,
  assetHoldingsClassificationKey,
  deleteSector,
  sectorsKey,
  setAssetSector,
} from "@utils/api/client/classifications"

describe("classifications api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(sectorsKey).toBe("/api/classifications/sectors")
    expect(assetClassificationKey("a1")).toBe("/api/classifications/a1")
    expect(assetExposuresKey("a1")).toBe("/api/classifications/a1/exposures")
    expect(assetHoldingsClassificationKey("a1")).toBe(
      "/api/classifications/a1/holdings",
    )
  })
})

describe("classifications api requests", () => {
  it("PUTs an asset's sector", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true })
    global.fetch = fetchMock as unknown as typeof fetch
    await setAssetSector("a1", "Tech")
    expect(fetchMock).toHaveBeenCalledWith("/api/classifications/a1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: '{"sector":"Tech"}',
    })
  })

  it("encodes the sector code it deletes", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 409 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await deleteSector("A&B")
    expect(res.status).toBe(409)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/classifications/sectors/A%26B",
      { method: "DELETE" },
    )
  })
})
