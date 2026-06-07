import positionsHandler from "@pages/api/assets/[id]/positions"

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

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: jest.fn(),
  handleResponse: jest.fn(),
  fetchError: jest.fn(
    (
      _req: unknown,
      res: { status: jest.Mock; json: jest.Mock },
      error: { message: string },
    ) => {
      res.status(500).json({ error: error.message })
    },
  ),
}))

jest.mock("@utils/api/bcConfig", () => ({
  getDataUrl: (path: string = "") => `http://data.test${path}`,
  getPositionsUrl: (path: string = "") => `http://positions.test${path}`,
}))

interface Req {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
}

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
}

function makeReq(id: string): Req {
  return { method: "GET", query: { id }, headers: {} }
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    json: jest.fn(),
  }
}

const COMPOSITE_ASSET_ID = "cpf-asset-id"

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("/api/assets/[id]/positions composite branch", () => {
  it("synthesises a position for a composite asset when whereHeld is empty", async () => {
    const routes: Record<string, () => Response> = {
      [`http://data.test/assets/${COMPOSITE_ASSET_ID}`]: () =>
        mockResponse({ data: { id: COMPOSITE_ASSET_ID } }),
      [`http://data.test/portfolios/asset/${COMPOSITE_ASSET_ID}?asAt=today`]:
        () => mockResponse({ data: [] }),
      [`http://positions.test/positions/composite/${COMPOSITE_ASSET_ID}?asAt=today`]:
        () =>
          mockResponse({
            data: {
              asset: { id: COMPOSITE_ASSET_ID },
              subAccounts: { OA: 145000, SA: 78000, MA: 58000, RA: 0 },
              quantityValues: { total: 281000 },
            },
          }),
    }
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = String(input)
      const responder = routes[url]
      if (!responder) {
        return Promise.reject(new Error(`unexpected fetch: ${url}`))
      }
      return Promise.resolve(responder())
    }) as unknown as typeof fetch

    const req = makeReq(COMPOSITE_ASSET_ID)
    const res = makeRes()

    await positionsHandler(
      req as unknown as Parameters<typeof positionsHandler>[0],
      res as unknown as Parameters<typeof positionsHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0] as {
      data: Array<{ portfolio: unknown; balance: number }>
    }
    expect(payload.data).toHaveLength(1)
    expect(payload.data[0].portfolio).toBeNull()
    expect(payload.data[0].balance).toBe(281000)
  })

  it("falls back to portfolio scan when composite endpoint returns null", async () => {
    const routes: Record<string, () => Response> = {
      [`http://data.test/assets/${COMPOSITE_ASSET_ID}`]: () =>
        mockResponse({ data: { id: COMPOSITE_ASSET_ID } }),
      [`http://data.test/portfolios/asset/${COMPOSITE_ASSET_ID}?asAt=today`]:
        () => mockResponse({ data: [] }),
      [`http://positions.test/positions/composite/${COMPOSITE_ASSET_ID}?asAt=today`]:
        () => mockResponse({ data: null }),
      "http://data.test/portfolios": () => mockResponse({ data: [] }),
    }
    global.fetch = jest.fn((input: RequestInfo) => {
      const url = String(input)
      const responder = routes[url]
      if (!responder) {
        return Promise.reject(new Error(`unexpected fetch: ${url}`))
      }
      return Promise.resolve(responder())
    }) as unknown as typeof fetch

    const req = makeReq(COMPOSITE_ASSET_ID)
    const res = makeRes()

    await positionsHandler(
      req as unknown as Parameters<typeof positionsHandler>[0],
      res as unknown as Parameters<typeof positionsHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json.mock.calls[0][0]).toEqual({ data: [] })
  })
})
