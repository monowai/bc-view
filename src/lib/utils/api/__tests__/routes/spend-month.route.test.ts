import spendMonthHandler from "@pages/api/independence/spend/[month]"

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
  month: string,
): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
  body: unknown
} {
  return { method, query: { month }, headers: {}, body: { entries: [] } }
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

type Req = Parameters<typeof spendMonthHandler>[0]
type Res = Parameters<typeof spendMonthHandler>[1]

describe("/api/independence/spend/[month] route", () => {
  it("proxies PUT to svc-retire /spend/:month", async () => {
    await spendMonthHandler(
      makeReq("PUT", "2026-11") as unknown as Req,
      makeRes() as unknown as Res,
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/spend/2026-11",
      expect.objectContaining({ method: "PUT" }),
    )
  })

  it("rejects a traversal month without calling the backend", async () => {
    await spendMonthHandler(
      makeReq("PUT", "../plans") as unknown as Req,
      makeRes() as unknown as Res,
    )

    expect(mockFetch).not.toHaveBeenCalled()
    const responseWriter = jest.requireMock("@utils/api/responseWriter")
    expect(responseWriter.fetchError).toHaveBeenCalled()
  })
})
