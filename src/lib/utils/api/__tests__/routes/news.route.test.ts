import newsHandler from "@pages/api/news"

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

beforeEach(() => {
  jest.clearAllMocks()
})

async function call(query: Record<string, string>): Promise<void> {
  await newsHandler(
    makeReq(query) as unknown as Parameters<typeof newsHandler>[0],
    makeRes() as unknown as Parameters<typeof newsHandler>[1],
  )
}

describe("/api/news route", () => {
  it("forwards the ticker and market to svc-data", async () => {
    await call({ tickers: "GNE", market: "NZX" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/news?tickers=GNE&market=NZX",
      expect.any(Object),
    )
  })

  it("omits market when not supplied", async () => {
    await call({ tickers: "AAPL" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/news?tickers=AAPL",
      expect.any(Object),
    )
  })
})
