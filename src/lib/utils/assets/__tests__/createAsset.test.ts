import { createAsset } from "@lib/assets/createAsset"

const option = {
  value: "VFUND",
  label: "VFUND - A Fund",
  symbol: "vfund",
  name: "A Fund",
  market: "LON",
  currency: "GBP",
}

describe("createAsset", () => {
  it("sends the category upper-cased, as BC category ids are", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { VFUND: { id: "a-1" } } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await createAsset({ ...option, type: "Mutual Fund" })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.data.VFUND.category).toBe("MUTUAL FUND")
  })

  it("defaults the category to EQUITY", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { VFUND: { id: "a-1" } } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await createAsset(option)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.data.VFUND.category).toBe("EQUITY")
  })

  it("surfaces the backend's message when the create fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "Unknown market LON" }),
    }) as unknown as typeof fetch

    await expect(createAsset(option)).rejects.toThrow("Unknown market LON")
  })
})
