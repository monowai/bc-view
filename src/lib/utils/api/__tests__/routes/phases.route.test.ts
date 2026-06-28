import phasesHandler from "@pages/api/independence/plans/[id]/phases"

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

function makeReq(
  method: string,
  id = "plan-123",
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

describe("/api/independence/plans/[id]/phases route", () => {
  it("proxies POST to backend /plans/:id/phases", async () => {
    const req = makeReq("POST", "plan-abc", {})
    const res = makeRes()

    await phasesHandler(
      req as unknown as Parameters<typeof phasesHandler>[0],
      res as unknown as Parameters<typeof phasesHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/plans/plan-abc/phases",
      expect.objectContaining({
        method: "POST",
      }),
    )
  })

  it("rejects GET with 405", async () => {
    const req = makeReq("GET")
    const res = makeRes()

    await phasesHandler(
      req as unknown as Parameters<typeof phasesHandler>[0],
      res as unknown as Parameters<typeof phasesHandler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
