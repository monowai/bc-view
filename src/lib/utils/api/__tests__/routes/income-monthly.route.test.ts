import monthlyHandler from "@pages/api/trns/income/monthly"

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

describe("/api/trns/income/monthly route", () => {
  it("forwards every report param, including the required currency", async () => {
    const req = makeReq({
      months: "12",
      groupBy: "sector",
      portfolioIds: "pf-a,pf-b",
      currency: "SGD",
    })

    await monthlyHandler(
      req as unknown as Parameters<typeof monthlyHandler>[0],
      makeRes() as unknown as Parameters<typeof monthlyHandler>[1],
    )

    const url = new URL(mockFetch.mock.calls[0][0] as string)
    expect(url.pathname).toBe("/trns/income/monthly")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      months: "12",
      groupBy: "sector",
      portfolioIds: "pf-a,pf-b",
      currency: "SGD",
    })
  })
})
