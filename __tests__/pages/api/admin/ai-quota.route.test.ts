import usersHandler from "@pages/api/admin/users"
import overviewHandler from "@pages/api/admin/ai-quota"
import userQuotaHandler from "@pages/api/admin/ai-quota/[id]"
import { NextApiHandler } from "next"

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
  getDataUrl: (path = "") => `http://data.test${path}`,
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

async function call(
  handler: NextApiHandler,
  method: string,
  query: Record<string, string | string[]> = {},
  body?: unknown,
): Promise<Res> {
  const res = makeRes()
  await handler({ method, query, headers: {}, body } as never, res as never)
  return res
}

function ok(data: unknown): unknown {
  return { status: 200, ok: true, json: () => Promise.resolve({ data }) }
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("/api/admin/users", () => {
  it("proxies the user list from svc-data", async () => {
    const data = [{ id: "u1", email: "a@b.com" }]
    mockFetch.mockResolvedValue(ok(data))

    const res = await call(usersHandler, "GET")

    expect(mockFetch).toHaveBeenCalledWith(
      "http://data.test/admin/users",
      expect.objectContaining({ method: "GET" }),
    )
    expect(res.json).toHaveBeenCalledWith({ data })
  })

  it("is read-only", async () => {
    const res = await call(usersHandler, "POST")

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("/api/admin/ai-quota", () => {
  it("proxies the quota overview from svc-agent", async () => {
    const data = { defaultLimit: 10, users: {} }
    mockFetch.mockResolvedValue(ok(data))

    const res = await call(overviewHandler, "GET")

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/quota/overview",
      expect.objectContaining({ method: "GET" }),
    )
    expect(res.json).toHaveBeenCalledWith({ data })
  })

  it("is read-only", async () => {
    const res = await call(overviewHandler, "PUT")

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe("/api/admin/ai-quota/[id]", () => {
  it("forwards a PUT with its body to the user's quota", async () => {
    mockFetch.mockResolvedValue(ok({ limit: 5 }))

    await call(userQuotaHandler, "PUT", { id: "u1" }, { weeklyLimit: 5 })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/quota/u1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ weeklyLimit: 5 }),
      }),
    )
  })

  it("forwards a DELETE to the user's quota", async () => {
    mockFetch.mockResolvedValue(ok({ limit: 10 }))

    await call(userQuotaHandler, "DELETE", { id: "u1" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/quota/u1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("URL-encodes the id", async () => {
    mockFetch.mockResolvedValue(ok({}))

    await call(userQuotaHandler, "DELETE", { id: "a b?c#d" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/quota/a%20b%3Fc%23d",
      expect.anything(),
    )
  })

  it.each(["..", "a/b", "a\\b", ""])(
    "rejects the unsafe id %p without calling upstream",
    async (id) => {
      const res = await call(userQuotaHandler, "DELETE", { id })

      expect(res.status).toHaveBeenCalledWith(400)
      expect(mockFetch).not.toHaveBeenCalled()
    },
  )

  it("does not allow GET", async () => {
    const res = await call(userQuotaHandler, "GET", { id: "u1" })

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
