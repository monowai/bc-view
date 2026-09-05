import apiKeyHandler from "@pages/api/me/api-keys/[id]"

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
  id = "key-1",
): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method, query: { id }, headers: {} }
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

describe("/api/me/api-keys/[id] route", () => {
  it("proxies DELETE to backend /me/api-keys/:id", async () => {
    const req = makeReq("DELETE", "key-42")
    const res = makeRes()

    await apiKeyHandler(
      req as unknown as Parameters<typeof apiKeyHandler>[0],
      res as unknown as Parameters<typeof apiKeyHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/me/api-keys/key-42",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("rejects a traversal id without calling the backend", async () => {
    const req = makeReq("DELETE", "../portfolios")
    const res = makeRes()

    await apiKeyHandler(
      req as unknown as Parameters<typeof apiKeyHandler>[0],
      res as unknown as Parameters<typeof apiKeyHandler>[1],
    )

    expect(mockFetch).not.toHaveBeenCalled()
    // sanitizePathParam throws; the handler routes it through fetchError.
    const responseWriter = jest.requireMock("@utils/api/responseWriter")
    expect(responseWriter.fetchError).toHaveBeenCalled()
  })

  it("rejects GET with 405 and does not call the backend", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await apiKeyHandler(
      req as unknown as Parameters<typeof apiKeyHandler>[0],
      res as unknown as Parameters<typeof apiKeyHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["DELETE"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
