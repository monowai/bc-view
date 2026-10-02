import type { NextApiHandler } from "next"
import conversationsHandler from "@pages/api/agent/conversations"
import conversationHandler from "@pages/api/agent/conversations/[id]"
import offboardConversationsHandler from "@pages/api/offboard/conversations"

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

interface Req {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
  body?: unknown
  url?: string
}

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
  end: jest.Mock
}

function makeReq(
  method: string,
  query: Record<string, string> = {},
  body?: unknown,
): Req {
  return { method, query, headers: {}, body }
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

function backendReturns(status: number, body?: unknown): void {
  mockFetch.mockResolvedValue({
    status,
    ok: status < 400,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(body === undefined ? "" : JSON.stringify(body)),
  })
}

async function call(handler: NextApiHandler, req: Req): Promise<Res> {
  const res = makeRes()
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("/api/agent/conversations", () => {
  it("lists conversations, forwarding page and size", async () => {
    const data = [{ id: "c1", title: "Hi" }]
    backendReturns(200, { data })

    const res = await call(
      conversationsHandler,
      makeReq("GET", { page: "1", size: "30" }),
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations?page=1&size=30",
      expect.objectContaining({ method: "GET" }),
    )
    expect(res.json).toHaveBeenCalledWith({ data })
  })

  it("ignores non-numeric paging params", async () => {
    backendReturns(200, { data: [] })

    await call(
      conversationsHandler,
      makeReq("GET", { page: "0&x=1", size: "abc" }),
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations",
      expect.anything(),
    )
  })

  it("creates a conversation", async () => {
    backendReturns(201, { data: { id: "c1" } })

    const res = await call(conversationsHandler, makeReq("POST", {}, {}))

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations",
      expect.objectContaining({ method: "POST" }),
    )
    expect(res.status).toHaveBeenCalledWith(201)
  })

  it("deletes all conversations", async () => {
    backendReturns(200, { deleted: 4 })

    const res = await call(conversationsHandler, makeReq("DELETE"))

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations",
      expect.objectContaining({ method: "DELETE" }),
    )
    expect(res.json).toHaveBeenCalledWith({ deleted: 4 })
  })
})

describe("/api/agent/conversations/[id]", () => {
  it("gets a conversation by id", async () => {
    backendReturns(200, { data: { id: "c1", messages: [] } })

    await call(conversationHandler, makeReq("GET", { id: "c1" }))

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations/c1",
      expect.objectContaining({ method: "GET" }),
    )
  })

  it("renames a conversation", async () => {
    backendReturns(200, { data: { id: "c1", title: "New" } })

    await call(
      conversationHandler,
      makeReq("PATCH", { id: "c1" }, { title: "New" }),
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations/c1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "New" }),
      }),
    )
  })

  it("passes a 204 delete through with no body", async () => {
    backendReturns(204)

    const res = await call(conversationHandler, makeReq("DELETE", { id: "c1" }))

    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.end).toHaveBeenCalled()
    expect(res.json).not.toHaveBeenCalled()
  })

  it("rejects a traversal id without calling the backend", async () => {
    const res = await call(
      conversationHandler,
      makeReq("GET", { id: "../admin" }),
    )

    expect(mockFetch).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it("forwards a 404 for an unknown conversation", async () => {
    backendReturns(404, { detail: "Conversation not found" })

    const res = await call(conversationHandler, makeReq("GET", { id: "nope" }))

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe("/api/offboard/conversations", () => {
  it("deletes all of the caller's conversations", async () => {
    backendReturns(200, { deleted: 2 })

    await call(offboardConversationsHandler, makeReq("DELETE"))

    expect(mockFetch).toHaveBeenCalledWith(
      "http://agent.test/agent/conversations",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("rejects GET", async () => {
    const res = await call(offboardConversationsHandler, makeReq("GET"))

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
