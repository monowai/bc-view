import apiKeysHandler from "@pages/api/me/api-keys/index"

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
        res.status(200).json({ data: [] })
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
        res.status(500).json({ error: error.message })
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

function makeReq(
  method: string,
  body?: unknown,
): {
  method: string
  body: unknown
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method, body, query: {}, headers: {} }
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

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/me/api-keys route", () => {
  it("proxies GET to backend /me/api-keys", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await apiKeysHandler(
      req as unknown as Parameters<typeof apiKeysHandler>[0],
      res as unknown as Parameters<typeof apiKeysHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/me/api-keys",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("proxies POST to backend /me/api-keys with the request body", async () => {
    const req = makeReq("POST", { name: "Agent", scopes: [] })
    const res = makeRes()

    await apiKeysHandler(
      req as unknown as Parameters<typeof apiKeysHandler>[0],
      res as unknown as Parameters<typeof apiKeysHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/me/api-keys",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(req.body),
      }),
    )
  })

  it("rejects DELETE with 405 and does not call the backend", async () => {
    const req = makeReq("DELETE")
    const res = makeRes()

    await apiKeysHandler(
      req as unknown as Parameters<typeof apiKeysHandler>[0],
      res as unknown as Parameters<typeof apiKeysHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET", "POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
