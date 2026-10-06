import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import handler from "@pages/api/agent/query/stream"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "u" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "t" }),
  },
}))

jest.mock("@utils/api/bcConfig", () => ({
  getAgentUrl: (path = "") => `http://agent.test${path}`,
}))

const mockFetch = jest.fn()

function makeReq(): EventEmitter {
  return Object.assign(new EventEmitter(), {
    method: "POST",
    headers: {},
    body: { query: "hi" },
  })
}

/**
 * A writable response: piped SSE bytes land in it, `finish` ends it, and
 * `close` is what the connection dropping early emits on it.
 */
function makeRes(): PassThrough {
  return Object.assign(new PassThrough(), {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
    flushHeaders: jest.fn(),
  })
}

/** Upstream SSE that emits one frame, then either stays open or ends. */
function upstream(opts: { end: boolean }): {
  response: unknown
  signal: () => AbortSignal | undefined
} {
  let captured: AbortSignal | undefined
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode("event:token\ndata:Hi\n\n"))
      if (opts.end) c.close()
    },
  })
  mockFetch.mockImplementation((_url: string, init: RequestInit) => {
    captured = init.signal ?? undefined
    return Promise.resolve({ ok: true, status: 200, body })
  })
  return { response: body, signal: () => captured }
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("/api/agent/query/stream", () => {
  it("aborts the upstream request when the browser goes away mid-stream", async () => {
    const { signal } = upstream({ end: false })
    const req = makeReq()
    const res = makeRes()
    res.resume()

    await handler(req as never, res as never)
    expect(signal()?.aborted).toBe(false)

    res.emit("close")

    expect(signal()?.aborted).toBe(true)
  })

  it("leaves a finished answer alone when the request closes afterwards", async () => {
    const { signal } = upstream({ end: true })
    const req = makeReq()
    const res = makeRes()
    res.resume()

    await handler(req as never, res as never)
    await new Promise((resolve) => res.on("finish", resolve))
    res.emit("close")

    expect(signal()?.aborted).toBe(false)
  })
})
