import watchlistHandler from "@pages/api/watchlist"
import itemsHandler from "@pages/api/watchlist/items"
import itemHandler from "@pages/api/watchlist/items/[itemId]"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "test-user" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "test-token" }),
  },
}))

jest.mock("@utils/api/fetchHelper", () => ({
  requestInit: jest.fn(
    (token: string, method: string) =>
      ({
        method,
        headers: { Authorization: `Bearer ${token}` },
      }) as unknown,
  ),
}))

jest.mock("@utils/api/responseWriter", () => {
  const handleResponse = jest
    .fn()
    .mockImplementation(
      (_response: Response, res: { status: jest.Mock; json: jest.Mock }) => {
        res.status(200).json({ data: {} })
      },
    )
  return {
    __esModule: true,
    default: handleResponse,
    handleResponse,
    fetchError: jest.fn(
      (
        _req: unknown,
        res: { status: jest.Mock; json: jest.Mock },
        error: { message: string },
      ) => {
        res.status(400).json({ error: error.message })
      },
    ),
  }
})

jest.mock("@utils/api/bcConfig", () => ({
  getDataUrl: (path: string): string => `http://data.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

type Handler = typeof watchlistHandler

interface Req {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
  body?: unknown
}

function makeRes(): {
  status: jest.Mock
  end: jest.Mock
  json: jest.Mock
  setHeader: jest.Mock
} {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  }
}

async function call(
  handler: Handler,
  req: Req,
): Promise<ReturnType<typeof makeRes>> {
  const res = makeRes()
  await handler(
    req as unknown as Parameters<Handler>[0],
    res as unknown as Parameters<Handler>[1],
  )
  return res
}

function lastFetch(): { url: string; init: RequestInit } {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, init }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/watchlist routes", () => {
  it("reads the caller's watchlist from the backend", async () => {
    await call(watchlistHandler, { method: "GET", query: {}, headers: {} })

    expect(lastFetch().url).toBe("http://data.test/watchlist")
    expect(lastFetch().init.method).toBe("GET")
  })

  it("allows only GET on the watchlist itself", async () => {
    const res = await call(watchlistHandler, {
      method: "DELETE",
      query: {},
      headers: {},
    })

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("forwards an item add to /watchlist/items", async () => {
    const body = { assetId: "asset-1", targetPrice: 10 }
    await call(itemsHandler, { method: "POST", query: {}, headers: {}, body })

    expect(lastFetch().url).toBe("http://data.test/watchlist/items")
    expect(lastFetch().init.method).toBe("POST")
    expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
  })

  it.each(["PATCH", "DELETE"])(
    "forwards %s to /watchlist/items/{itemId}",
    async (method) => {
      const body = method === "PATCH" ? { clearTarget: true } : undefined
      await call(itemHandler, {
        method,
        query: { itemId: "wi-9" },
        headers: {},
        body,
      })

      expect(lastFetch().url).toBe("http://data.test/watchlist/items/wi-9")
      expect(lastFetch().init.method).toBe(method)
      if (body) {
        expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
      }
    },
  )

  it.each(["../../portfolios", "a/b", "a\\b"])(
    "rejects item id %s without calling the backend",
    async (itemId) => {
      await call(itemHandler, {
        method: "DELETE",
        query: { itemId },
        headers: {},
      })

      expect(mockFetch).not.toHaveBeenCalled()
      const responseWriter = jest.requireMock("@utils/api/responseWriter")
      expect(responseWriter.fetchError).toHaveBeenCalled()
    },
  )
})
