import handler from "@pages/api/assets/[id]/positions"

const mockGetSession = jest.fn()
const mockGetAccessToken = jest.fn()
const mockFetchError = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}))

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: jest.fn(),
  fetchError: (...args: unknown[]) => mockFetchError(...args),
}))

type Handler = typeof handler

function makeReq(
  query: Record<string, string> = { id: "A1" },
  method = "GET",
): Parameters<Handler>[0] {
  return { method, query, headers: {} } as unknown as Parameters<Handler>[0]
}

function makeRes(): {
  res: Parameters<Handler>[1]
  status: jest.Mock
  json: jest.Mock
  setHeader: jest.Mock
} {
  const status = jest.fn().mockReturnThis()
  const json = jest.fn()
  const setHeader = jest.fn()
  return {
    res: { status, json, setHeader } as unknown as Parameters<Handler>[1],
    status,
    json,
    setHeader,
  }
}

const ok = (body: unknown): Response =>
  ({ ok: true, status: 200, json: () => Promise.resolve(body) }) as Response
const notOk = (status: number): Response =>
  ({ ok: false, status, json: () => Promise.resolve({}) }) as Response

type Route = [RegExp, () => Response | Promise<Response>]

/** Route fetch calls by URL so call order (parallel fetches) does not matter. */
function route(routes: Route[]): void {
  global.fetch = jest.fn((url: string) => {
    for (const [re, fn] of routes) {
      if (re.test(url)) return Promise.resolve(fn())
    }
    return Promise.reject(new Error(`unrouted fetch ${url}`))
  }) as unknown as typeof fetch
}

const pos = (assetId: string, total: number): Record<string, unknown> => ({
  asset: { id: assetId },
  quantityValues: { total },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: {} })
  mockGetAccessToken.mockResolvedValue({ token: "tok" })
})

describe("GET /api/assets/[id]/positions", () => {
  it("rejects non-GET with 405", async () => {
    const { res, status } = makeRes()
    await handler(makeReq({ id: "A1" }, "POST"), res)
    expect(status).toHaveBeenCalledWith(405)
  })

  it("returns 401 without a session", async () => {
    mockGetSession.mockResolvedValue(null)
    const { res, status } = makeRes()
    await handler(makeReq(), res)
    expect(status).toHaveBeenCalledWith(401)
  })

  it("returns an empty list when the asset is not found", async () => {
    route([
      [/\/assets\/A1/, () => notOk(404)],
      [/portfolios\/asset/, () => ok({ data: [] })],
    ])
    const { res, status, json } = makeRes()
    await handler(makeReq(), res)
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({ data: [] })
  })

  it("propagates other asset lookup failures", async () => {
    route([
      [/\/assets\/A1/, () => notOk(500)],
      [/portfolios\/asset/, () => ok({ data: [] })],
    ])
    const { res, status, json } = makeRes()
    await handler(makeReq(), res)
    expect(status).toHaveBeenCalledWith(500)
    expect(json.mock.calls[0][0].error).toContain("500")
  })

  it("returns the position held in each portfolio where the asset is held", async () => {
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "RES" } })],
      [
        /portfolios\/asset/,
        () => ok({ data: [{ code: "P1" }, { code: "P2" }, { code: "P3" }] }),
      ],
      [/\/P1\?/, () => ok({ data: { positions: { x: pos("RES", 5) } } })],
      [/\/P2\?/, () => notOk(500)],
      [/\/P3\?/, () => ok({ data: { positions: { x: pos("OTHER", 1) } } })],
    ])
    const { res, status, json } = makeRes()
    await handler(makeReq({ id: "A1", date: "2024-01-01" }), res)
    expect(status).toHaveBeenCalledWith(200)
    const data = json.mock.calls[0][0].data
    expect(data[0].balance).toBe(5)
    expect(data[1]).toMatchObject({ position: null, balance: 0 })
    expect(data[2]).toMatchObject({ position: null, balance: 0 })
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("/assets/")
    expect(
      (global.fetch as jest.Mock).mock.calls.some(([u]: [string]) =>
        u.includes("asAt=2024-01-01"),
      ),
    ).toBe(true)
  })

  it("returns a zero balance when a portfolio holdings fetch throws", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "A1" } })],
      [/portfolios\/asset/, () => ok({ data: [{ code: "P1" }] })],
      [
        /\/P1\?/,
        () => {
          throw new Error("down")
        },
      ],
    ])
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    expect(json.mock.calls[0][0].data[0]).toMatchObject({
      position: null,
      balance: 0,
    })
    spy.mockRestore()
  })

  it("synthesises a composite position when no portfolio holds the asset", async () => {
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "A1" } })],
      [/portfolios\/asset/, () => notOk(500)],
      [
        /positions\/composite\/A1/,
        () =>
          ok({
            data: { quantityValues: { total: 42 }, subAccounts: { a: 1 } },
          }),
      ],
    ])
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    const entry = json.mock.calls[0][0].data[0]
    expect(entry.portfolio).toBeNull()
    expect(entry.balance).toBe(42)
  })

  it("sums sub-accounts when the composite has no total", async () => {
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "A1" } })],
      [/portfolios\/asset/, () => ok({ data: [] })],
      [
        /positions\/composite\/A1/,
        () => ok({ data: { subAccounts: { a: "10", b: 5, c: null } } }),
      ],
    ])
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    expect(json.mock.calls[0][0].data[0].balance).toBe(15)
  })

  it("scans all portfolios when there is no composite position", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "A1" } })],
      [/portfolios\/asset/, () => ok({ data: [] })],
      [/positions\/composite/, () => ok({ data: null })],
      [
        /\/portfolios$/,
        () => ok({ data: [{ code: "P1" }, { code: "P2" }, { code: "P3" }] }),
      ],
      [/\/P1\?/, () => ok({ data: { positions: { x: pos("A1", 3) } } })],
      [/\/P2\?/, () => notOk(500)],
      [
        /\/P3\?/,
        () => {
          throw new Error("down")
        },
      ],
    ])
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    const data = json.mock.calls[0][0].data
    expect(data).toHaveLength(1)
    expect(data[0].portfolio.code).toBe("P1")
    expect(data[0].balance).toBe(3)
    spy.mockRestore()
  })

  it("returns empty when the composite call errors and the portfolio list fails", async () => {
    route([
      [/\/assets\/A1/, () => ok({ data: { id: "A1" } })],
      [/portfolios\/asset/, () => ok({ data: [] })],
      [
        /positions\/composite/,
        () => {
          throw new Error("x")
        },
      ],
      [/\/portfolios$/, () => notOk(500)],
    ])
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    expect(json).toHaveBeenCalledWith({ data: [] })
  })

  it("delegates unexpected errors to fetchError", async () => {
    mockGetAccessToken.mockRejectedValue(new Error("boom"))
    const { res } = makeRes()
    await handler(makeReq(), res)
    expect(mockFetchError).toHaveBeenCalled()
  })
})
