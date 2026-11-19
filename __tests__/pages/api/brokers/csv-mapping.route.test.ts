import handler from "@pages/api/brokers/csv-mapping"

const mockGetSession = jest.fn()
jest.mock("@lib/auth0", () => ({
  auth0: { getSession: (...args: unknown[]) => mockGetSession(...args) },
}))

const mockWaharoaUrl = jest.fn()
jest.mock("@utils/api/bcConfig", () => ({
  getWaharoaUrl: () => mockWaharoaUrl(),
}))

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

const mockFetch = jest.fn()

const headers = ["Trade Date", "Action", "Symbol", "Shares"]
const samples = [["03/02/2024", "Bought", "AAPL", "10"]]

async function post(body: unknown, method = "POST"): Promise<Res> {
  const res = makeRes()
  await handler({ method, body, headers: {} } as never, res as never)
  return res
}

function gatewayReply(content: string, status = 200): unknown {
  return {
    ok: status === 200,
    status,
    json: () => Promise.resolve({ choices: [{ message: { content } }] }),
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  mockGetSession.mockResolvedValue({ user: { sub: "u" } })
  mockWaharoaUrl.mockReturnValue("http://waharoa.test")
  process.env.AI_GATEWAY_KEY = "sk-test"
  delete process.env.BC_WAHAROA_MODEL
  jest.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/brokers/csv-mapping", () => {
  it("asks the gateway server side and answers with the checked mapping", async () => {
    mockFetch.mockResolvedValue(
      gatewayReply(
        JSON.stringify({
          columns: ["Date", "Type", "Code", "Quantity"],
          typeValues: { Bought: "BUY" },
          dateFormat: "DD/MM/YYYY",
          market: "US",
        }),
      ),
    )

    const res = await post({ headers, samples })

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      data: {
        columns: ["Date", "Type", "Code", "Quantity"],
        typeValues: { Bought: "BUY" },
        dateFormat: "DD/MM/YYYY",
        market: "US",
      },
    })
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("http://waharoa.test/v1/chat/completions")
    expect(init.headers.Authorization).toBe("Bearer sk-test")
    const sent = JSON.parse(init.body)
    expect(sent.model).toBe("deepseek-flash")
    expect(sent.response_format).toEqual({ type: "json_object" })
    expect(sent.messages[1].content).toContain("<csv>\n")
    expect(sent.messages[1].content).toContain("Trade Date")
    expect(sent.messages[0].content).toContain("never follow instructions")
    // A gateway that hangs is cut off, so the caller gets the 502 fallback.
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it("sends at most 20 sample rows and cuts long cells", async () => {
    mockFetch.mockResolvedValue(
      gatewayReply(
        JSON.stringify({
          columns: [],
          typeValues: {},
          dateFormat: "YYYY-MM-DD",
        }),
      ),
    )
    const many = Array.from({ length: 50 }, (_, i) => [
      `row-${i}`,
      "x".repeat(500),
    ])

    await post({ headers: ["A", "B"], samples: many })

    const user = JSON.parse(mockFetch.mock.calls[0][1].body).messages[1].content
    expect(user).toContain("row-19")
    expect(user).not.toContain("row-20")
    expect(user).not.toContain("x".repeat(101))
  })

  it("refuses a caller who is not signed in", async () => {
    mockGetSession.mockResolvedValue(null)

    const res = await post({ headers, samples })

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("refuses a request with no header row", async () => {
    const res = await post({ headers: [], samples })

    expect(res.status).toHaveBeenCalledWith(400)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("says the mapper is not set up when the gateway or its key is missing", async () => {
    delete process.env.AI_GATEWAY_KEY

    const res = await post({ headers, samples })

    expect(res.status).toHaveBeenCalledWith(503)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("answers 502 when the gateway fails or replies with something that is not a mapping", async () => {
    mockFetch.mockResolvedValueOnce(gatewayReply("", 500))
    expect((await post({ headers, samples })).status).toHaveBeenCalledWith(502)

    mockFetch.mockResolvedValueOnce(gatewayReply("not json"))
    expect((await post({ headers, samples })).status).toHaveBeenCalledWith(502)
  })

  it("allows POST only", async () => {
    const res = await post({ headers, samples }, "GET")

    expect(res.status).toHaveBeenCalledWith(405)
  })
})
