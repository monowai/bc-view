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

const mockGetWaharoaUrl = jest.fn<string | undefined, []>()
const mockGetWaharoaPublicUrl = jest.fn<string | undefined, []>()

jest.mock("@utils/api/bcConfig", () => ({
  getDataActuatorUrl: () => "http://data.test",
  getPositionActuatorUrl: () => "http://position.test",
  getEventActuatorUrl: () => "http://event.test",
  getRetireActuatorUrl: () => "http://retire.test",
  getRebalanceActuatorUrl: () => "http://rebalance.test",
  getAgentActuatorUrl: () => "http://agent.test",
  getWaharoaUrl: () => mockGetWaharoaUrl(),
  getWaharoaPublicUrl: () => mockGetWaharoaPublicUrl(),
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

interface Route {
  status?: number
  body: unknown
}

function mockActuatorFetches(extra: Record<string, Route> = {}): void {
  const services = ["data", "position", "event", "retire", "rebalance", "agent"]
  const routes: Record<string, Route> = {}
  for (const svc of services) {
    routes[`http://${svc}.test/actuator/health`] = { body: { status: "UP" } }
    routes[`http://${svc}.test/actuator/info`] = {
      body: { build: { version: "1.0" } },
    }
  }
  Object.assign(routes, extra)
  global.fetch = jest.fn((input: RequestInfo) => {
    const url = String(input)
    const route = routes[url]
    if (route !== undefined) {
      const status = route.status ?? 200
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(route.body),
      } as unknown as Response)
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`))
  }) as unknown as typeof fetch
}

interface ServiceOut {
  name: string
  url: string
  link?: string
  health: { status: string } | null
  info: { build?: { version?: string } } | null
  error: string | null
}

async function callAsAdmin(): Promise<ServiceOut[]> {
  mockGetSession.mockResolvedValue({ user: { sub: "test-user" } })
  mockGetAccessToken.mockResolvedValue({ token: makeAdminToken() })
  const req = makeReq()
  const res = makeRes()
  await servicesHandler(
    req as unknown as Parameters<typeof servicesHandler>[0],
    res as unknown as Parameters<typeof servicesHandler>[1],
  )
  expect(res.status).toHaveBeenCalledWith(200)
  return (res.json.mock.calls[0][0] as { services: ServiceOut[] }).services
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetWaharoaUrl.mockReturnValue(undefined)
  mockGetWaharoaPublicUrl.mockReturnValue(undefined)
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
    const payload = res.json.mock.calls[0][0] as { services: ServiceOut[] }
    expect(payload.services.map((s) => s.name)).toEqual([
      "bc-data",
      "bc-position",
      "bc-event",
      "bc-retire",
      "bc-rebalance",
      "bc-agent",
    ])
    const agent = payload.services.find((s) => s.name === "bc-agent")
    expect(agent?.health?.status).toBe("UP")
    expect(agent?.url).toBe("http://agent.test")
  })

  it("omits waharoa when BC_WAHAROA is not configured", async () => {
    mockActuatorFetches()
    const services = await callAsAdmin()
    expect(services.map((s) => s.name)).not.toContain("waharoa")
  })

  it("reports waharoa UP from LiteLLM readiness with its version and public link", async () => {
    mockGetWaharoaUrl.mockReturnValue("http://waharoa.test:4000")
    mockGetWaharoaPublicUrl.mockReturnValue("https://waharoa.public.test")
    mockActuatorFetches({
      "http://waharoa.test:4000/health/readiness": {
        body: {
          status: "healthy",
          db: "connected",
          litellm_version: "1.83.3",
        },
      },
    })

    const services = await callAsAdmin()
    const waharoa = services.find((s) => s.name === "waharoa")

    expect(waharoa).toBeDefined()
    expect(waharoa?.health?.status).toBe("UP")
    expect(waharoa?.info?.build?.version).toBe("1.83.3")
    expect(waharoa?.url).toBe("http://waharoa.test:4000")
    expect(waharoa?.link).toBe("https://waharoa.public.test")
  })

  it("reports waharoa DOWN when readiness is not healthy", async () => {
    mockGetWaharoaUrl.mockReturnValue("http://waharoa.test:4000")
    mockActuatorFetches({
      "http://waharoa.test:4000/health/readiness": {
        status: 503,
        body: { status: "unhealthy", db: "disconnected" },
      },
    })

    const services = await callAsAdmin()
    const waharoa = services.find((s) => s.name === "waharoa")

    expect(waharoa?.health?.status).toBe("DOWN")
    expect(waharoa?.link).toBeUndefined()
  })

  it("reports waharoa UNREACHABLE when the probe throws", async () => {
    mockGetWaharoaUrl.mockReturnValue("http://waharoa.test:4000")
    mockActuatorFetches()

    const services = await callAsAdmin()
    const waharoa = services.find((s) => s.name === "waharoa")

    expect(waharoa?.health?.status).toBe("UNREACHABLE")
    expect(waharoa?.error).toContain("unexpected fetch")
  })
})
