import handler from "@pages/api/corporate-events/load/[...params]"

const mockGetSession = jest.fn()
const mockGetAccessToken = jest.fn()
const mockHandleResponse = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}))

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockHandleResponse(...args),
  fetchError: jest.fn(),
}))

jest.mock("@utils/api/bcConfig", () => ({
  getEventUrl: (path = "") => `http://svc-event${path}`,
}))

type Handler = typeof handler

function makeReq(
  params: string[],
  asAt = "2016-02-03",
): Parameters<Handler>[0] {
  return {
    method: "POST",
    query: { params, asAt },
    headers: {},
  } as unknown as Parameters<Handler>[0]
}

const res = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
} as unknown as Parameters<Handler>[1]

const calledUrl = (): string => (global.fetch as jest.Mock).mock.calls[0][0]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ user: {} })
  mockGetAccessToken.mockResolvedValue({ token: "tok" })
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, status: 202 } as Response),
  ) as unknown as typeof fetch
})

describe("POST /api/corporate-events/load/[...params]", () => {
  it("loads a portfolio's events while the caller waits", async () => {
    await handler(makeReq(["pf-1"]), res)
    expect(calledUrl()).toBe("http://svc-event/load/pf-1?asAt=2016-02-03")
  })

  it("starts a portfolio's load in the background", async () => {
    await handler(makeReq(["pf-1", "background"]), res)
    expect(calledUrl()).toBe(
      "http://svc-event/load/pf-1/background?asAt=2016-02-03",
    )
    expect(mockHandleResponse).toHaveBeenCalled()
  })
})
