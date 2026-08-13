import weightsFromHoldingsHandler from "@pages/api/rebalance/models/[modelId]/plans/weights-from-holdings"

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
  getRebalanceUrl: (path: string): string => `http://rebalance.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

function makeReq(
  method: string,
  query: Record<string, string | string[]> = {},
): {
  method: string
  query: Record<string, string | string[]>
  headers: Record<string, string>
} {
  return { method, query, headers: {} }
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

describe("/api/rebalance/models/[modelId]/plans/weights-from-holdings route", () => {
  it("proxies GET with portfolioId/valueCurrency to the backend weights-from-holdings URL", async () => {
    const req = makeReq("GET", {
      modelId: "model-1",
      portfolioId: "portfolio-1",
      valueCurrency: "SGD",
    })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/models/model-1/plans/weights-from-holdings?portfolioId=portfolio-1&valueCurrency=SGD",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("defaults valueCurrency to USD when omitted", async () => {
    const req = makeReq("GET", {
      modelId: "model-1",
      portfolioId: "portfolio-1",
    })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/models/model-1/plans/weights-from-holdings?portfolioId=portfolio-1&valueCurrency=USD",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("URL-encodes query params so a malicious portfolioId cannot inject extra query parameters", async () => {
    const req = makeReq("GET", {
      modelId: "model-1",
      portfolioId: "abc&adminOverride=true",
      valueCurrency: "USD",
    })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/models/model-1/plans/weights-from-holdings?portfolioId=abc%26adminOverride%3Dtrue&valueCurrency=USD",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("rejects a path-traversal modelId instead of interpolating it raw into the upstream URL", async () => {
    const req = makeReq("GET", {
      modelId: "../..%2Fadmin",
      portfolioId: "portfolio-1",
    })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(mockFetch).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid modelId" })
  })

  it("resolves an array modelId to its first element rather than joining it into the path", async () => {
    const req = makeReq("GET", {
      modelId: ["model-1", "model-2"],
      portfolioId: "portfolio-1",
    })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/models/model-1/plans/weights-from-holdings?portfolioId=portfolio-1&valueCurrency=USD",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("rejects POST with 405", async () => {
    const req = makeReq("POST", { modelId: "model-1" })
    const res = makeRes()

    await weightsFromHoldingsHandler(
      req as unknown as Parameters<typeof weightsFromHoldingsHandler>[0],
      res as unknown as Parameters<typeof weightsFromHoldingsHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
