import watchlistsHandler from "@pages/api/watchlists"
import watchlistHandler from "@pages/api/watchlists/[id]"
import itemsHandler from "@pages/api/watchlists/[id]/items"
import itemHandler from "@pages/api/watchlists/[id]/items/[itemId]"

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

type Handler = typeof watchlistsHandler

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

async function call(handler: Handler, req: Req): Promise<void> {
  await handler(
    req as unknown as Parameters<Handler>[0],
    makeRes() as unknown as Parameters<Handler>[1],
  )
}

function lastFetch(): { url: string; init: RequestInit } {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return { url, init }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/watchlists routes", () => {
  it("lists watchlists from the backend", async () => {
    await call(watchlistsHandler, { method: "GET", query: {}, headers: {} })

    expect(lastFetch().url).toBe("http://data.test/watchlists")
    expect(lastFetch().init.method).toBe("GET")
  })

  it("forwards the create body", async () => {
    const body = { code: "tech", name: "Tech ideas" }
    await call(watchlistsHandler, {
      method: "POST",
      query: {},
      headers: {},
      body,
    })

    expect(lastFetch().url).toBe("http://data.test/watchlists")
    expect(lastFetch().init.method).toBe("POST")
    expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
  })

  it.each(["GET", "PATCH", "DELETE"])(
    "forwards %s to /watchlists/{id}",
    async (method) => {
      const body = method === "PATCH" ? { name: "Renamed" } : undefined
      await call(watchlistHandler, {
        method,
        query: { id: "wl-1" },
        headers: {},
        body,
      })

      expect(lastFetch().url).toBe("http://data.test/watchlists/wl-1")
      expect(lastFetch().init.method).toBe(method)
      if (body) {
        expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
      }
    },
  )

  it("forwards an item add to /watchlists/{id}/items", async () => {
    const body = { assetId: "asset-1", targetPrice: 10 }
    await call(itemsHandler, {
      method: "POST",
      query: { id: "wl-1" },
      headers: {},
      body,
    })

    expect(lastFetch().url).toBe("http://data.test/watchlists/wl-1/items")
    expect(lastFetch().init.method).toBe("POST")
    expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
  })

  it.each(["PATCH", "DELETE"])(
    "forwards %s to /watchlists/{id}/items/{itemId}",
    async (method) => {
      const body = method === "PATCH" ? { clearTarget: true } : undefined
      await call(itemHandler, {
        method,
        query: { id: "wl-1", itemId: "wi-9" },
        headers: {},
        body,
      })

      expect(lastFetch().url).toBe(
        "http://data.test/watchlists/wl-1/items/wi-9",
      )
      expect(lastFetch().init.method).toBe(method)
      if (body) {
        expect(JSON.parse(lastFetch().init.body as string)).toEqual(body)
      }
    },
  )

  it.each([
    ["watchlist id", watchlistHandler, { id: "../portfolios" }],
    ["item watchlist id", itemHandler, { id: "a/b", itemId: "wi-1" }],
    ["item id", itemHandler, { id: "wl-1", itemId: "../../me" }],
  ])(
    "rejects a traversal %s without calling the backend",
    async (_label, handler, query) => {
      await call(handler as Handler, {
        method: "DELETE",
        query: query as Record<string, string>,
        headers: {},
      })
      expect(mockFetch).not.toHaveBeenCalled()
      const responseWriter = jest.requireMock("@utils/api/responseWriter")
      expect(responseWriter.fetchError).toHaveBeenCalled()
    },
  )

  it("rejects a traversal watchlist id on POST to items", async () => {
    await call(itemsHandler, {
      method: "POST",
      query: { id: "../x" },
      headers: {},
      body: { assetId: "a" },
    })

    expect(mockFetch).not.toHaveBeenCalled()
    const responseWriter = jest.requireMock("@utils/api/responseWriter")
    expect(responseWriter.fetchError).toHaveBeenCalled()
  })
})
