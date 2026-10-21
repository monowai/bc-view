import {
  fxHistoryKey,
  fxKey,
  fxPairsKey,
  fxProvidersKey,
  postFxRates,
} from "@utils/api/client/fx"

describe("fx api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(fxKey).toBe("/api/fx")
    expect(fxProvidersKey).toBe("/api/fx/providers")
    expect(fxHistoryKey("USD", "NZD", 3)).toBe(
      "/api/fx/history?from=USD&to=NZD&months=3",
    )
    expect(
      fxPairsKey([
        { from: "USD", to: "NZD" },
        { from: "SGD", to: "NZD" },
      ]),
    ).toBe("/api/fx?pairs=USD:NZD,SGD:NZD")
  })
})

describe("postFxRates", () => {
  it("posts the rate request as JSON", async () => {
    const res = { ok: true } as Response
    const fetchMock = jest.fn().mockResolvedValue(res)
    global.fetch = fetchMock as unknown as typeof fetch
    await expect(
      postFxRates({ rateDate: "today", pairs: [{ from: "USD", to: "NZD" }] }),
    ).resolves.toBe(res)
    expect(fetchMock).toHaveBeenCalledWith("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"rateDate":"today","pairs":[{"from":"USD","to":"NZD"}]}',
    })
  })

  it("passes a failed response back to the caller", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch
    const res = await postFxRates({ pairs: [] })
    expect(res.status).toBe(503)
  })
})
