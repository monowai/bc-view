import aggregateHandler from "@pages/api/performance/aggregate"

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
        res.status(200).json({ data: { series: [] } })
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
  getPositionsUrl: (path: string): string => `http://positions.test${path}`,
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

describe("/api/performance/aggregate route", () => {
  it("proxies POST to backend /performance/aggregate", async () => {
    const req = makeReq("POST", {
      portfolioCodes: ["P1", "P2"],
      months: 12,
      displayCurrency: "USD",
    })
    const res = makeRes()

    await aggregateHandler(
      req as unknown as Parameters<typeof aggregateHandler>[0],
      res as unknown as Parameters<typeof aggregateHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/performance/aggregate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(req.body),
      }),
    )
  })

  it("rejects GET with 405", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await aggregateHandler(
      req as unknown as Parameters<typeof aggregateHandler>[0],
      res as unknown as Parameters<typeof aggregateHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
