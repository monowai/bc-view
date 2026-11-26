import handler from "@pages/api/trns/settles/[trnId]"

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
  trnId = "leg-1",
): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method, query: { trnId }, headers: {} }
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

type Req = Parameters<typeof handler>[0]
type Res = Parameters<typeof handler>[1]

describe("/api/trns/settles/[trnId] route", () => {
  it("proxies GET to the trade the leg settles", async () => {
    await handler(
      makeReq("GET", "leg-42") as unknown as Req,
      makeRes() as unknown as Res,
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/trns/leg-42/settles",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("rejects a traversal id without calling the backend", async () => {
    await handler(
      makeReq("GET", "../portfolios") as unknown as Req,
      makeRes() as unknown as Res,
    )

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
