import servicesHandler from "@pages/api/admin/services"

const mockGetSession = jest.fn()
const mockGetAccessToken = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}))

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: jest.fn(),
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
  getDataActuatorUrl: () => "http://data.test",
  getPositionActuatorUrl: () => "http://position.test",
  getEventActuatorUrl: () => "http://event.test",
  getRetireActuatorUrl: () => "http://retire.test",
  getRebalanceActuatorUrl: () => "http://rebalance.test",
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
  end: jest.Mock
}

function makeReq(method = "GET"): Req {
  return { method, query: {}, headers: {} }
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
  }
}

function makeAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ scope: "beancounter:admin" }),
  ).toString("base64url")
  return `header.${payload}.sig`
}

function mockActuatorFetches(): void {
  const services = ["data", "position", "event", "retire", "rebalance"]
  const routes: Record<string, unknown> = {}
  for (const svc of services) {
    routes[`http://${svc}.test/actuator/health`] = { status: "UP" }
    routes[`http://${svc}.test/actuator/info`] = { build: { version: "1.0" } }
  }
  global.fetch = jest.fn((input: RequestInfo) => {
    const url = String(input)
    const body = routes[url]
    if (body !== undefined) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response)
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  }) as unknown as typeof fetch
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("GET /api/admin/services", () => {
  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null)

    const req = makeReq()
    const res = makeRes()
    await servicesHandler(
      req as unknown as Parameters<typeof servicesHandler>[0],
      res as unknown as Parameters<typeof servicesHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it("returns 403 when token lacks beancounter:admin scope", async () => {
    mockGetSession.mockResolvedValue({ user: { sub: "test-user" } })
    const nonAdminPayload = Buffer.from(
      JSON.stringify({ scope: "openid profile" }),
    ).toString("base64url")
    mockGetAccessToken.mockResolvedValue({
      token: `header.${nonAdminPayload}.sig`,
    })
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const req = makeReq()
    const res = makeRes()
    await servicesHandler(
      req as unknown as Parameters<typeof servicesHandler>[0],
      res as unknown as Parameters<typeof servicesHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns 200 with service statuses for admin token", async () => {
    mockGetSession.mockResolvedValue({ user: { sub: "test-user" } })
    mockGetAccessToken.mockResolvedValue({ token: makeAdminToken() })
    mockActuatorFetches()

    const req = makeReq()
    const res = makeRes()
    await servicesHandler(
      req as unknown as Parameters<typeof servicesHandler>[0],
      res as unknown as Parameters<typeof servicesHandler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(200)
    const payload = res.json.mock.calls[0][0] as { services: unknown[] }
    expect(payload.services).toHaveLength(5)
  })
})
