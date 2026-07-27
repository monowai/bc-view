import lifestyleCatalogHandler from "@pages/api/independence/lifestyle-catalog"

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
  getRetireUrl: (path: string): string => `http://retire.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

function makeReq(method: string): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method, query: {}, headers: {} }
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

describe("/api/independence/lifestyle-catalog route", () => {
  it("proxies GET to backend /lifestyle/catalog", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await lifestyleCatalogHandler(
      req as unknown as Parameters<typeof lifestyleCatalogHandler>[0],
      res as unknown as Parameters<typeof lifestyleCatalogHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/lifestyle/catalog",
      expect.objectContaining({
        method: "GET",
      }),
    )
  })

  it("rejects POST with 405", async () => {
    const req = makeReq("POST")
    const res = makeRes()

    await lifestyleCatalogHandler(
      req as unknown as Parameters<typeof lifestyleCatalogHandler>[0],
      res as unknown as Parameters<typeof lifestyleCatalogHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
