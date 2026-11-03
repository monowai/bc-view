import handler from "@pages/api/holdings/weights"

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
  query: Record<string, string> = { portfolioIds: "P1" },
  method = "GET",
): Parameters<Handler>[0] {
  return { method, query, headers: {} } as unknown as Parameters<Handler>[0]
}

function makeRes(): {
  res: Parameters<Handler>[1]
  status: jest.Mock
  json: jest.Mock
  end: jest.Mock
  setHeader: jest.Mock
} {
  const status = jest.fn().mockReturnThis()
  const json = jest.fn()
  const end = jest.fn()
  const setHeader = jest.fn()
  return {
    res: { status, json, end, setHeader } as unknown as Parameters<Handler>[1],
    status,
    json,
    end,
    setHeader,
  }
}

const position = (
  id: string,
  code: string,
  marketValue: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  asset: {
    id,
    code,
    name: `${code} Inc`,
    effectiveReportCategory: "Equity",
    market: { code: "US", currency: { code: "USD" } },
    ...extra,
  },
  moneyValues: {
    PORTFOLIO: { marketValue },
    TRADE: { priceData: { close: 10 }, currency: { code: "USD" } },
  },
})

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: {} })
  mockGetAccessToken.mockResolvedValue({ token: "tok" })
  global.fetch = jest.fn()
})

describe("GET /api/holdings/weights", () => {
  it("rejects non-GET methods with 405", async () => {
    const { res, status, end, setHeader } = makeRes()
    await handler(makeReq({}, "POST"), res)
    expect(setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(status).toHaveBeenCalledWith(405)
    expect(end).toHaveBeenCalled()
  })

  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const { res, status, json } = makeRes()
    await handler(makeReq(), res)
    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith({ error: "Not authenticated" })
  })

  it("returns 400 when portfolioIds is missing", async () => {
    const { res, status, json } = makeRes()
    await handler(makeReq({}), res)
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      error: "portfolioIds query parameter required",
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("returns 400 when only separators are supplied", async () => {
    const { res, status, json } = makeRes()
    await handler(makeReq({ portfolioIds: "," }), res)
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      error: "At least one portfolio code required",
    })
  })

  it("rejects codes that fail the allowlist without calling upstream", async () => {
    const { res, status, json } = makeRes()
    await handler(makeReq({ portfolioIds: "OK,../etc" }), res)
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      error: "Invalid portfolio code format",
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("aggregates positions across portfolios into sorted weights", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        okJson({
          data: {
            portfolio: { currency: { code: "NZD" } },
            positions: {
              a: position("1", "AAA", 300),
              b: position("2", "BBB", 100),
              cash: position("3", "USD", 999, {
                effectiveReportCategory: "Cash",
              }),
              zero: position("4", "ZZZ", 0),
              noId: { asset: {}, moneyValues: {} },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        okJson({
          data: {
            positions: {
              a: position("1", "AAA", 100),
              l: position("5", "LSE", 200, {
                market: { code: "LSE", currency: { code: "GBP" } },
              }),
            },
          },
        }),
      )

    const { res, status, json } = makeRes()
    await handler(makeReq({ portfolioIds: "P1,P2" }), res)

    expect(status).toHaveBeenCalledWith(200)
    const body = json.mock.calls[0][0]
    expect(body.currency).toBe("NZD")
    expect(body.totalValue).toBe(700)
    expect(body.weights.map((w: { assetCode: string }) => w.assetCode)).toEqual(
      ["AAA", "LSE:LSE", "BBB"],
    )
    expect(body.weights[0].value).toBe(400)
    expect(body.weights[0].weight).toBeCloseTo(400 / 700)
    expect(body.weights[0].price).toBe(10)
    expect(body.weights[0].priceCurrency).toBe("USD")
  })

  it("skips portfolios whose upstream fetch fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {})
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce(
        okJson({ data: { positions: { a: position("1", "AAA", 50) } } }),
      )
    const { res, json } = makeRes()
    await handler(makeReq({ portfolioIds: "P1,P2" }), res)
    const body = json.mock.calls[0][0]
    expect(body.weights).toHaveLength(1)
    expect(body.currency).toBe("USD")
    spy.mockRestore()
  })

  it("falls back to asset id for names and drops tiny positions", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        data: {
          positions: {
            big: {
              asset: { id: "9", effectiveReportCategory: "Equity" },
              moneyValues: { PORTFOLIO: { marketValue: 100000 } },
            },
            tiny: position("8", "TNY", 1),
          },
        },
      }),
    )
    const { res, json } = makeRes()
    await handler(makeReq(), res)
    const body = json.mock.calls[0][0]
    expect(body.weights).toHaveLength(1)
    expect(body.weights[0].assetCode).toBe("9")
    expect(body.weights[0].assetName).toBe("9")
  })

  it("delegates unexpected errors to fetchError", async () => {
    mockGetAccessToken.mockRejectedValue(new Error("boom"))
    const { res } = makeRes()
    await handler(makeReq(), res)
    expect(mockFetchError).toHaveBeenCalled()
  })
})
