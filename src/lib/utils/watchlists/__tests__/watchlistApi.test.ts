import {
  WatchlistApiError,
  addWatchlistItem,
  removeWatchlistItem,
} from "@lib/watchlists/watchlistApi"

function response(status: number, text: string): Response {
  return {
    ok: status < 400,
    status,
    text: () => Promise.resolve(text),
    // Like a real Response: an empty body is not valid JSON.
    json: () =>
      text
        ? Promise.resolve(JSON.parse(text))
        : Promise.reject(new SyntaxError("Unexpected end of JSON input")),
  } as unknown as Response
}

describe("watchlistApi", () => {
  it("removes an item at /api/watchlist/items/{itemId}", async () => {
    const fetchMock = jest.fn().mockResolvedValue(response(204, ""))
    global.fetch = fetchMock as unknown as typeof fetch

    await removeWatchlistItem("wi-7")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/watchlist/items/wi-7",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("treats a 204 delete as success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(204, "")) as unknown as typeof fetch

    await expect(removeWatchlistItem("wi-1")).resolves.toBeUndefined()
  })

  it("treats an empty 200 body as success", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(200, "")) as unknown as typeof fetch

    await expect(removeWatchlistItem("wi-1")).resolves.toBeUndefined()
  })

  it("carries the status and server message on failure", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(400, JSON.stringify({ message: "supply addedPrice" })),
      ) as unknown as typeof fetch

    const failure = addWatchlistItem({ assetId: "a" })
    await expect(failure).rejects.toBeInstanceOf(WatchlistApiError)
    await expect(failure).rejects.toMatchObject({
      status: 400,
      message: "supply addedPrice",
    })
  })
})
