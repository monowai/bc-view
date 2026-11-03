import handler from "@pages/api/admin/loggers/[service]"

const mockRequireAdmin = jest.fn()
jest.mock("@utils/api/requireAdmin", () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock("@utils/api/bcConfig", () => ({
  getDataActuatorUrl: () => "http://data.test",
  getPositionActuatorUrl: () => "http://position.test",
  getEventActuatorUrl: () => "http://event.test",
  getRetireActuatorUrl: () => "http://retire.test",
  getRebalanceActuatorUrl: () => "http://rebalance.test",
  getAgentActuatorUrl: () => "http://agent.test",
}))
jest.mock("@utils/api/responseWriter", () => ({
  fetchError: (
    _req: unknown,
    res: { status: jest.Mock; json: jest.Mock },
    error: { message: string },
  ) => res.status(500).json({ error: error.message }),
}))

function makeRes(): any {
  const res = {
    status: jest.fn(),
    setHeader: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
  }
  res.status.mockReturnValue(res)
  res.setHeader.mockReturnValue(res)
  return res
}

const call = async (req: Record<string, unknown>): Promise<any> => {
  const res = makeRes()
  await handler(req as never, res as never)
  return res
}

describe("/api/admin/loggers/[service]", () => {
  let fetchMock: jest.Mock
  beforeEach(() => {
    mockRequireAdmin.mockReset()
    mockRequireAdmin.mockResolvedValue({ ok: true, token: "tok" })
    fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"loggers":{}}'),
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  it("rejects unknown services", async () => {
    const res = await call({ method: "GET", query: { service: "nope" } })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "Unknown service" })
  })

  it("stops when the admin guard fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false })
    await call({ method: "GET", query: { service: "bc-data" } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("proxies GET to the service actuator, accepting array query", async () => {
    const res = await call({ method: "GET", query: { service: ["bc-event"] } })
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://event.test/actuator/loggers",
    )
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/json",
    )
    expect(res.send).toHaveBeenCalledWith('{"loggers":{}}')
  })

  it.each([
    ["bc-position", "http://position.test"],
    ["bc-retire", "http://retire.test"],
    ["bc-rebalance", "http://rebalance.test"],
    ["bc-agent", "http://agent.test"],
  ])("routes %s to its actuator", async (service, base) => {
    await call({ method: "GET", query: { service } })
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/actuator/loggers`)
  })

  it("POST requires a logger name", async () => {
    const res = await call({
      method: "POST",
      query: { service: "bc-data" },
      body: { configuredLevel: "INFO" },
    })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "logger required" })
  })

  it("POST rejects an invalid level", async () => {
    const res = await call({
      method: "POST",
      query: { service: "bc-data" },
      body: { logger: "a.b", configuredLevel: "LOUD" },
    })
    expect(res.status).toHaveBeenCalledWith(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("POST sets the level, and null resets it", async () => {
    fetchMock.mockResolvedValue({ status: 204 })
    const res = await call({
      method: "POST",
      query: { service: "bc-data" },
      body: { logger: "com.x/y", configuredLevel: null },
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("http://data.test/actuator/loggers/com.x%2Fy")
    expect(JSON.parse(init.body)).toEqual({ configuredLevel: null })
    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.end).toHaveBeenCalled()
  })

  it("rejects other methods with 405", async () => {
    const res = await call({ method: "PUT", query: { service: "bc-data" } })
    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET", "POST"])
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it("routes failures to fetchError", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    const res = await call({ method: "GET", query: { service: "bc-data" } })
    expect(res.json).toHaveBeenCalledWith({ error: "down" })
  })
})
