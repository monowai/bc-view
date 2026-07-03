import writeRows from "@pages/api/trns/import"

const mockGetSession = jest.fn()
const mockGetAccessToken = jest.fn()
const mockFetchError = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  },
}))

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: jest.fn(),
  fetchError: (...args: unknown[]) => mockFetchError(...args),
}))

jest.mock("@lib/broker", () => ({
  getBrokerConfig: jest.fn(() => ({ topic: "test-topic" })),
  getBroker: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ success: true }),
  })),
}))

interface Req {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
  body: { portfolio: { id: string }; row: string[] }
}

interface Res {
  status: jest.Mock
  json: jest.Mock
}

function makeReq(): Req {
  return {
    method: "POST",
    query: {},
    headers: {},
    body: { portfolio: { id: "p1" }, row: ["", "", "", "", "", "TRN-001"] },
  }
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("POST /api/trns/import", () => {
  it("routes getAccessToken throw through fetchError, not as unhandled rejection", async () => {
    mockGetSession.mockResolvedValue({ user: { sub: "test-user" } })
    mockGetAccessToken.mockRejectedValue(new Error("Auth0 token error"))

    const req = makeReq()
    const res = makeRes()

    await expect(
      writeRows(
        req as unknown as Parameters<typeof writeRows>[0],
        res as unknown as Parameters<typeof writeRows>[1],
      ),
    ).resolves.toBeUndefined()

    expect(mockFetchError).toHaveBeenCalled()
    const errorArg = mockFetchError.mock.calls[0][2] as Error
    expect(errorArg.message).toBe("Auth0 token error")
  })
})
