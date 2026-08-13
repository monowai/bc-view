import executionsHandler from "@pages/api/rebalance/executions/index"

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
  // Mirrors the real handleResponse's ok/not-ok branch (see
  // src/lib/utils/api/responseWriter.ts) so error-propagation tests can
  // exercise the handler's catch -> fetchError path, same as production.
  const handleResponse = jest
    .fn()
    .mockImplementation(
      async (
        response: { ok: boolean; status: number; json: () => Promise<unknown> },
        res: { status: jest.Mock; json: jest.Mock },
      ) => {
        if (!response.ok) {
          throw new Error(`Backend error ${response.status}`)
        }
        const data = await response.json()
        res.status(200).json(data)
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
  getRebalanceUrl: (path: string): string => `http://rebalance.test${path}`,
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

describe("/api/rebalance/executions route", () => {
  it("proxies GET to backend /executions with the auth header", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await executionsHandler(
      req as unknown as Parameters<typeof executionsHandler>[0],
      res as unknown as Parameters<typeof executionsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith("http://rebalance.test/executions", {
      method: "GET",
      headers: { Authorization: "Bearer test-token" },
    })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("proxies POST with the create-execution body (model-based)", async () => {
    const req = makeReq("POST", {
      planId: "plan-1",
      portfolioIds: ["portfolio-1"],
      filterByModel: true,
    })
    const res = makeRes()

    await executionsHandler(
      req as unknown as Parameters<typeof executionsHandler>[0],
      res as unknown as Parameters<typeof executionsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith("http://rebalance.test/executions", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: JSON.stringify(req.body),
    })
  })

  it("proxies POST with the create-execution body (ad-hoc)", async () => {
    const req = makeReq("POST", {
      mode: "AD_HOC",
      portfolioIds: ["portfolio-1"],
      currency: "SGD",
    })
    const res = makeRes()

    await executionsHandler(
      req as unknown as Parameters<typeof executionsHandler>[0],
      res as unknown as Parameters<typeof executionsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/executions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(req.body),
      }),
    )
  })

  it("propagates a backend error status via fetchError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ message: "Invalid create request" }),
    })
    const req = makeReq("POST", { portfolioIds: [] })
    const res = makeRes()

    await executionsHandler(
      req as unknown as Parameters<typeof executionsHandler>[0],
      res as unknown as Parameters<typeof executionsHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Backend error 400" }),
    )
  })

  it("rejects PUT with 405 and does not call the backend", async () => {
    const req = makeReq("PUT")
    const res = makeRes()

    await executionsHandler(
      req as unknown as Parameters<typeof executionsHandler>[0],
      res as unknown as Parameters<typeof executionsHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET", "POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
