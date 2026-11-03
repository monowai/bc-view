import registerHandler from "@pages/api/register"

const mockGetSession = jest.fn()
const mockGetAccessToken = jest.fn()
const mockWriteSystemUserId = jest.fn()
const mockHandleErrors = jest.fn()
const mockFetchError = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}))
jest.mock("@lib/auth0Management", () => ({
  writeSystemUserId: (...args: unknown[]) => mockWriteSystemUserId(...args),
}))
jest.mock("@utils/api/bcConfig", () => ({
  getDataUrl: (path: string) => `http://data.test${path}`,
}))
jest.mock("@utils/api/responseWriter", () => ({
  hasError: (r: { status: number }) => r.status >= 400,
  handleErrors: (...args: unknown[]) => mockHandleErrors(...args),
  fetchError: (...args: unknown[]) => mockFetchError(...args),
}))

const makeRes = (): any => {
  const res: any = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  res.end = jest.fn().mockReturnValue(res)
  res.setHeader = jest.fn()
  return res
}

const jwtWith = (payload: Record<string, unknown>): string =>
  `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`

const CLAIM = "https://holdsworth.app/claims/system_user_id"
const req = (method = "POST"): any => ({ method, headers: {} })

describe("POST /api/register", () => {
  const fetchMock = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    mockGetSession.mockResolvedValue({ user: { sub: "auth0|1" } })
    mockGetAccessToken.mockResolvedValue({ token: jwtWith({}) })
    fetchMock.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ data: { id: "su-1" } }),
    })
  })

  it("returns 401 when there is no session", async () => {
    mockGetSession.mockResolvedValue(null)
    const res = makeRes()
    await registerHandler(req(), res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects non-POST methods with 405", async () => {
    const res = makeRes()
    await registerHandler(req("GET"), res)
    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["POST"])
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it("registers and writes the system user id when the token lacks the claim", async () => {
    const res = makeRes()
    await registerHandler(req(), res)
    expect(fetchMock).toHaveBeenCalledWith(
      "http://data.test/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ active: true }),
      }),
    )
    expect(mockWriteSystemUserId).toHaveBeenCalledWith("auth0|1", "su-1")
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ data: { id: "su-1" } })
  })

  it("skips the metadata write when the token claim already matches", async () => {
    mockGetAccessToken.mockResolvedValue({
      token: jwtWith({ [CLAIM]: "su-1" }),
    })
    await registerHandler(req(), makeRes())
    expect(mockWriteSystemUserId).not.toHaveBeenCalled()
  })

  it("resyncs when the token claim is stale", async () => {
    mockGetAccessToken.mockResolvedValue({ token: jwtWith({ [CLAIM]: "old" }) })
    await registerHandler(req(), makeRes())
    expect(mockWriteSystemUserId).toHaveBeenCalledWith("auth0|1", "su-1")
  })

  it("treats a malformed token as missing claim", async () => {
    mockGetAccessToken.mockResolvedValue({ token: "h.!!notjson.s" })
    await registerHandler(req(), makeRes())
    expect(mockWriteSystemUserId).toHaveBeenCalled()
  })

  it("treats a token without payload segment as missing claim", async () => {
    mockGetAccessToken.mockResolvedValue({ token: "onlyone" })
    await registerHandler(req(), makeRes())
    expect(mockWriteSystemUserId).toHaveBeenCalled()
  })

  it("does not write metadata when the backend returns no id", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({}),
    })
    await registerHandler(req(), makeRes())
    expect(mockWriteSystemUserId).not.toHaveBeenCalled()
  })

  it("delegates backend errors to handleErrors", async () => {
    const response = { status: 500, json: jest.fn() }
    fetchMock.mockResolvedValue(response)
    const res = makeRes()
    await registerHandler(req(), res)
    expect(mockHandleErrors).toHaveBeenCalledWith(response)
    expect(res.json).not.toHaveBeenCalled()
  })

  it("reports unexpected failures via fetchError", async () => {
    const boom = new Error("boom")
    fetchMock.mockRejectedValue(boom)
    const res = makeRes()
    await registerHandler(req(), res)
    expect(mockFetchError).toHaveBeenCalledWith(expect.anything(), res, boom)
  })
})
