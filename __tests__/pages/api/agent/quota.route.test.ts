import quotaHandler from "@pages/api/agent/quota"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "u" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "t" }),
  },
}))

jest.mock("@utils/api/fetchHelper", () => ({
  requestInit: (_token: string, method: string) => ({ method }),
}))

jest.mock("@utils/api/bcConfig", () => ({
  getAgentUrl: (path = "") => `http://agent.test${path}`,
}))

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
  end: jest.Mock
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
    end: jest.fn(),
  }
}

const mockFetch = jest.fn()

async function call(method: string): Promise<Res> {
  const res = makeRes()
  await quotaHandler({ method, query: {}, headers: {} } as never, res as never)
  return res
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("/api/agent/quota", () => {
  it("proxies the caller's quota from svc-agent", async () => {
    const data = { limit: 10, used: 3, remaining: 7, unlimited: false }
    mockFetch.mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data }),
    })

    const res = await call("GET")

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/quota",
      expect.objectContaining({ method: "GET" }),
    )
    expect(res.json).toHaveBeenCalledWith({ data })
  })

  it("is read-only", async () => {
    const res = await call("PUT")

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
