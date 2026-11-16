import { Readable } from "node:stream"
import handler, { config } from "@pages/api/agent/screenshot"
import { auth0 } from "@lib/auth0"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "u" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "t" }),
  },
}))

jest.mock("@utils/api/bcConfig", () => ({
  getAgentUrl: (path = "") => `http://agent.test${path}`,
}))

const MB = 1024 * 1024
const MULTIPART = "multipart/form-data; boundary=----bc"

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

/** An unparsed request, as Next hands it over with the body parser off. */
function makeReq(
  chunks: Buffer[],
  headers: Record<string, string> = { "content-type": MULTIPART },
  method = "POST",
): Readable {
  return Object.assign(Readable.from(chunks), {
    method,
    headers,
    url: "/api/agent/screenshot",
  })
}

const mockFetch = jest.fn()

/** An upstream that reads the whole forwarded body, then answers. */
function upstream(status: number, body: unknown): { received: () => Buffer } {
  const received: Buffer[] = []
  mockFetch.mockImplementation(async (_url: string, init: RequestInit) => {
    const reader = (init.body as ReadableStream<Uint8Array>).getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received.push(Buffer.from(value))
    }
    return {
      ok: status < 400,
      status,
      statusText: "",
      url: "http://agent.test/agent/screenshot",
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    }
  })
  return { received: () => Buffer.concat(received) }
}

async function call(req: Readable): Promise<Res> {
  const res = makeRes()
  await handler(req as never, res as never)
  return res
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(console, "error").mockImplementation(() => {})
  ;(auth0.getSession as jest.Mock).mockResolvedValue({ user: { sub: "u" } })
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("/api/agent/screenshot", () => {
  it("leaves the body unparsed so the upload can be streamed", () => {
    expect(config.api.bodyParser).toBe(false)
  })

  it("forwards the multipart body unchanged, with its boundary and the caller's token", async () => {
    const proposal = { documentType: "HOLDINGS", rows: [] }
    const { received } = upstream(200, proposal)

    const res = await call(
      makeReq([Buffer.from("------bc\r\n"), Buffer.from("image-bytes")]),
    )

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("http://agent.test/agent/screenshot")
    expect(init.method).toBe("POST")
    expect(init.duplex).toBe("half")
    expect(init.headers["Content-Type"]).toBe(MULTIPART)
    expect(init.headers.Authorization).toBe("Bearer t")
    expect(received().toString()).toBe("------bc\r\nimage-bytes")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(proposal)
  })

  it("refuses a declared length over the limit without reading or forwarding it", async () => {
    const res = await call(
      makeReq([], {
        "content-type": MULTIPART,
        "content-length": String(9 * MB),
      }),
    )

    expect(mockFetch).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(413)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("larger than 8 MB"),
      }),
    )
  })

  it("stops an undeclared body once it passes the limit", async () => {
    const { received } = upstream(200, {})
    const chunk = Buffer.alloc(MB)

    const res = await call(makeReq(Array.from({ length: 10 }, () => chunk)))

    expect(res.status).toHaveBeenCalledWith(413)
    expect(received().length).toBeLessThanOrEqual(8 * MB + 64 * 1024)
  })

  it("lets an image of exactly 8 MB through with its multipart envelope", async () => {
    upstream(200, { documentType: "HOLDINGS", rows: [] })
    const envelope = Buffer.alloc(400)

    const res = await call(makeReq([envelope, Buffer.alloc(8 * MB)]))

    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("refuses a body that is not multipart", async () => {
    const res = await call(makeReq([], { "content-type": "application/json" }))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(415)
  })

  it("passes the reader's refusal on with its status and reason", async () => {
    upstream(422, { message: "The image shows no brokerage holdings" })

    const res = await call(makeReq([Buffer.from("x")]))

    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "The image shows no brokerage holdings",
      }),
    )
  })

  it("allows POST only", async () => {
    const res = await call(makeReq([], {}, "GET"))

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["POST"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("answers 401 without a session", async () => {
    ;(auth0.getSession as jest.Mock).mockResolvedValue(null)

    const res = await call(makeReq([Buffer.from("x")]))

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
