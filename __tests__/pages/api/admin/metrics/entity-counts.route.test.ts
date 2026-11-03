import handler from "@pages/api/admin/metrics/entity-counts"

const mockRequireAdmin = jest.fn()
jest.mock("@utils/api/requireAdmin", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock("@utils/api/bcConfig", () => ({
  getDataActuatorUrl: () => "http://data.test",
}))
jest.mock("@utils/api/responseWriter", () => ({
  fetchError: (
    _req: unknown,
    res: { status: jest.Mock; json: jest.Mock },
    error: { message: string },
  ) => res.status(500).json({ error: error.message }),
}))

function makeRes(): any {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
  }
}

const call = async (method = "GET"): Promise<any> => {
  const res = makeRes()
  await handler({ method } as never, res as never)
  return res
}

function metric(
  value?: number,
  tags?: { tag: string; values: string[] }[],
): any {
  return {
    name: "m",
    measurements: value === undefined ? [] : [{ statistic: "VALUE", value }],
    availableTags: tags,
  }
}

function mockFetch(routes: Record<string, unknown | null>): jest.Mock {
  const f = jest.fn((input: RequestInfo) => {
    const url = String(input).replace("http://data.test/actuator/metrics/", "")
    const body = routes[url]
    if (body === undefined || body === null)
      return Promise.resolve({ ok: false, status: 404 })
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  })
  global.fetch = f as unknown as typeof fetch
  return f
}

describe("GET /api/admin/metrics/entity-counts", () => {
  beforeEach(() => {
    mockRequireAdmin.mockReset()
    mockRequireAdmin.mockResolvedValue({ ok: true, token: "tok" })
  })

  it("rejects non-GET with 405", async () => {
    const res = await call("POST")
    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it("stops when the admin guard fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false })
    const f = mockFetch({})
    const res = await call()
    expect(f).not.toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it("returns 502 when the root metric is unavailable", async () => {
    mockFetch({})
    const res = await call()
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it("returns counts sorted desc plus breakdowns, skipping missing ones", async () => {
    const f = mockFetch({
      "beancounter.entity.count": metric(undefined, [
        { tag: "entity", values: ["asset", "portfolio"] },
      ]),
      "beancounter.entity.count?tag=entity:asset": metric(5),
      "beancounter.entity.count?tag=entity:portfolio": metric(50),
      "beancounter.asset.count.by_market": metric(undefined, [
        { tag: "market", values: ["US", "N Z"] },
      ]),
      "beancounter.asset.count.by_market?tag=market:US": metric(3),
      "beancounter.asset.count.by_market?tag=market:N%20Z": metric(),
    })
    const res = await call()
    expect(res.status).toHaveBeenCalledWith(200)
    const body = res.json.mock.calls[0][0]
    expect(body.service).toBe("bc-data")
    expect(body.counts).toEqual([
      { entity: "portfolio", count: 50 },
      { entity: "asset", count: 5 },
    ])
    expect(body.breakdowns).toEqual({
      "asset.count.by_market": [
        { entity: "US", count: 3 },
        { entity: "N Z", count: 0 },
      ],
    })
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer tok")
  })

  it("reports upstream exceptions via fetchError", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("boom")),
    ) as unknown as typeof fetch
    const res = await call()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: "boom" })
  })
})
