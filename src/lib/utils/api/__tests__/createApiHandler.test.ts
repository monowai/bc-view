import { createApiHandler } from "../createApiHandler"
import { fetchError } from "@utils/api/responseWriter"
import { auth0 } from "@lib/auth0"

// Mock Auth0 v4
jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "test-user" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "test-token" }),
  },
}))

// Mock fetchHelper
jest.mock("@utils/api/fetchHelper", () => ({
  requestInit: jest.fn(
    (token: string, method: string) =>
      ({
        method,
        headers: { Authorization: `Bearer ${token}` },
      }) as any,
  ),
}))

// Mock responseWriter
jest.mock("@utils/api/responseWriter", () => {
  const handleResponse = jest
    .fn()
    .mockImplementation((_response: Response, res: any) => {
      res.status(200).json({ ok: true })
    })
  return {
    __esModule: true,
    default: handleResponse,
    handleResponse,
    fetchError: jest.fn((_req: any, res: any, error: any) => {
      res.status(500).json({ error: error.message })
    }),
  }
})

// Mock global fetch - use a plain object since Response may not exist in Node test env
const mockResponse = { status: 200, ok: true, json: () => Promise.resolve({}) }
const mockFetch = jest.fn().mockResolvedValue(mockResponse)
global.fetch = mockFetch as any

function createMockReq(method: string, body?: any, query?: any): any {
  return {
    method,
    body,
    query: query || {},
    headers: {},
  } as any
}

function createMockRes(): any {
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

describe("createApiHandler", () => {
  it("handles GET request with static URL", async () => {
    const handler = createApiHandler({ url: "http://backend/items" })
    const req = createMockReq("GET")
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("rejects disallowed methods with 405", async () => {
    const handler = createApiHandler({ url: "http://backend/items" })
    const req = createMockReq("POST")
    const res = createMockRes()

    await handler(req, res)

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("allows multiple methods", async () => {
    const handler = createApiHandler({
      url: "http://backend/items",
      methods: ["GET", "POST", "DELETE"],
    })

    const req = createMockReq("DELETE")
    const res = createMockRes()
    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("forwards body for POST requests", async () => {
    const handler = createApiHandler({
      url: "http://backend/items",
      methods: ["POST"],
    })
    const req = createMockReq("POST", { name: "test" })
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.objectContaining({ body: '{"name":"test"}' }),
    )
  })

  it("does not forward body for GET requests", async () => {
    const handler = createApiHandler({ url: "http://backend/items" })
    const req = createMockReq("GET")
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.not.objectContaining({ body: expect.anything() }),
    )
  })

  it("supports dynamic URL function", async () => {
    const handler = createApiHandler({
      url: (req) => `http://backend/items/${req.query.id}`,
      methods: ["GET"],
    })
    const req = createMockReq("GET", undefined, { id: "42" })
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items/42",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("calls fetchError on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"))

    const handler = createApiHandler({ url: "http://backend/items" })
    const req = createMockReq("GET")
    const res = createMockRes()

    await handler(req, res)

    expect(fetchError).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({ message: "network failure" }),
    )
  })

  it("returns 401 when not authenticated", async () => {
    ;(auth0.getSession as jest.Mock).mockResolvedValueOnce(null)

    const handler = createApiHandler({ url: "http://backend/items" })
    const req = createMockReq("GET")
    const res = createMockRes()

    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("forwards body for PATCH but not DELETE", async () => {
    const handler = createApiHandler({
      url: "http://backend/items",
      methods: ["PATCH", "DELETE"],
    })

    // PATCH should include body
    const patchReq = createMockReq("PATCH", { name: "updated" })
    const patchRes = createMockRes()
    await handler(patchReq, patchRes)
    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.objectContaining({ body: '{"name":"updated"}' }),
    )

    mockFetch.mockClear()

    // DELETE should not include body
    const deleteReq = createMockReq("DELETE")
    const deleteRes = createMockRes()
    await handler(deleteReq, deleteRes)
    expect(mockFetch).toHaveBeenCalledWith(
      "http://backend/items",
      expect.not.objectContaining({ body: expect.anything() }),
    )
  })
})
