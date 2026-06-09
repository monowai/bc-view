import allocationHandler from "@pages/api/holdings/allocation"

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

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/holdings/allocation route", () => {
  it("forwards currency query param to backend", async () => {
    const req = makeReq({ asAt: "today", currency: "SGD" })
    const res = makeRes()

    await allocationHandler(
      req as unknown as Parameters<typeof allocationHandler>[0],
      res as unknown as Parameters<typeof allocationHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/allocation?asAt=today&currency=SGD",
      expect.any(Object),
    )
  })

  it("omits currency when not supplied", async () => {
    const req = makeReq({ asAt: "today" })
    const res = makeRes()

    await allocationHandler(
      req as unknown as Parameters<typeof allocationHandler>[0],
      res as unknown as Parameters<typeof allocationHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/allocation?asAt=today",
      expect.any(Object),
    )
  })

  it("forwards both ids and currency", async () => {
    const req = makeReq({ asAt: "today", ids: "p1,p2", currency: "USD" })
    const res = makeRes()

    await allocationHandler(
      req as unknown as Parameters<typeof allocationHandler>[0],
      res as unknown as Parameters<typeof allocationHandler>[1],
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://positions.test/allocation?asAt=today&ids=p1%2Cp2&currency=USD",
      expect.any(Object),
    )
  })
})
