import commitHandler from "@pages/api/rebalance/executions/[id]/commit"

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
  id = "exec-1",
  body?: unknown,
): {
  method: string
  body: unknown
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method, body, query: { id }, headers: {} }
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

describe("/api/rebalance/executions/[id]/commit route", () => {
  it("proxies POST to backend /executions/:id/commit with body and the auth header", async () => {
    const req = makeReq("POST", "exec-1", {
      portfolioId: "portfolio-1",
      transactionStatus: "PROPOSED",
      brokerId: "broker-1",
    })
    const res = makeRes()

    await commitHandler(
      req as unknown as Parameters<typeof commitHandler>[0],
      res as unknown as Parameters<typeof commitHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/executions/exec-1/commit",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: JSON.stringify(req.body),
      },
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("uses the id from the route params to build the backend URL", async () => {
    const req = makeReq("POST", "exec-xyz", { portfolioId: "portfolio-1" })
    const res = makeRes()

    await commitHandler(
      req as unknown as Parameters<typeof commitHandler>[0],
      res as unknown as Parameters<typeof commitHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://rebalance.test/executions/exec-xyz/commit",
      expect.any(Object),
    )
  })

  it("propagates a backend error status via fetchError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Commit failed" }),
    })
    const req = makeReq("POST", "exec-1", { portfolioId: "portfolio-1" })
    const res = makeRes()

    await commitHandler(
      req as unknown as Parameters<typeof commitHandler>[0],
      res as unknown as Parameters<typeof commitHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Backend error 500" }),
    )
  })

  it("rejects GET with 405 and does not call the backend", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await commitHandler(
      req as unknown as Parameters<typeof commitHandler>[0],
      res as unknown as Parameters<typeof commitHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
