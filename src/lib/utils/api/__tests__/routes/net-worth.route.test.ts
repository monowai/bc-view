import netWorthHandler from "@pages/api/net-worth"

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
  getPositionsUrl: (path: string): string => `http://positions.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

function makeReq(query: Record<string, string>): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method: "GET", query, headers: {} }
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

async function call(query: Record<string, string>): Promise<void> {
  const req = makeReq(query)
  const res = makeRes()
  await netWorthHandler(
    req as unknown as Parameters<typeof netWorthHandler>[0],
    res as unknown as Parameters<typeof netWorthHandler>[1],
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/net-worth route", () => {
  it("forwards currency, ids and codes to svc-position", async () => {
    await call({ asAt: "today", ids: "a,b", codes: "X,Y", currency: "SGD" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/net-worth?asAt=today&ids=a%2Cb&codes=X%2CY&currency=SGD",
      expect.any(Object),
    )
  })

  it("defaults asAt to today", async () => {
    await call({ currency: "USD" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/net-worth?asAt=today&currency=USD",
      expect.any(Object),
    )
  })
})
