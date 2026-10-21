import {
  WatchlistApiError,
  addWatchlistItem,
  dismissWatchlistAlert,
  removeWatchlistItem,
  updateWatchlistItem,
} from "@utils/api/client/watchlist"

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

describe("watchlist api client", () => {
  it("dismisses an alert and returns the remaining alerts", async () => {
    const remaining = [{ id: "wa-2" }]
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(200, JSON.stringify({ data: remaining })))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(dismissWatchlistAlert("wa-1")).resolves.toEqual(remaining)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/watchlist/alerts/wa-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("carries the status when a dismiss fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(404, JSON.stringify({ message: "no such alert" })),
      ) as unknown as typeof fetch

    await expect(dismissWatchlistAlert("wa-9")).rejects.toMatchObject({
      status: 404,
      message: "no such alert",
    })
  })

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

  it("accepts svc-data's 200 {deleted} answer to a delete", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        response(200, JSON.stringify({ deleted: "wi-1" })),
      ) as unknown as typeof fetch

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

  it("throws a clear error when an add answers with no body", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(204, "")) as unknown as typeof fetch

    await expect(addWatchlistItem({ assetId: "a" })).rejects.toThrow(
      /no response body/i,
    )
  })

  it("throws a clear error when an update answers with an empty 200", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(200, "")) as unknown as typeof fetch

    await expect(
      updateWatchlistItem("wi-1", { clearTarget: true }),
    ).rejects.toThrow(/no response body/i)
  })
})
