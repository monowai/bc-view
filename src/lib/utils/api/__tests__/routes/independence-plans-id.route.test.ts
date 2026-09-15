import planHandler from "@pages/api/independence/independence-plans/[id]"
import duplicateHandler from "@pages/api/independence/independence-plans/[id]/duplicate"
import primaryHandler from "@pages/api/independence/independence-plans/[id]/primary"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "test-user" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "test-token" }),
  },
}))

jest.mock("@utils/api/fetchHelper", () => ({
  requestInit: jest.fn(
    (token: string, method: string) =>
      ({
        method,
        headers: { Authorization: `Bearer ${token}` },
      }) as unknown,
  ),
}))

jest.mock("@utils/api/responseWriter", () => {
  const handleResponse = jest
    .fn()
    .mockImplementation(
      (_response: Response, res: { status: jest.Mock; json: jest.Mock }) => {
        res.status(200).json({ data: {} })
      },
    )
  return {
    __esModule: true,
    default: handleResponse,
    handleResponse,
    fetchError: jest.fn(
      (
        _req: unknown,
        res: { status: jest.Mock; json: jest.Mock },
        error: { message: string },
      ) => {
        res.status(500).json({ error: error.message })
      },
    ),
  }
})

jest.mock("@utils/api/bcConfig", () => ({
  getRetireUrl: (path: string): string => `http://retire.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

type Handler = typeof planHandler

interface Req {
  method: string
  query: Record<string, string | string[]>
  headers: Record<string, string>
  body?: unknown
}

function makeReq(method: string, id: string | string[]): Req {
  return { method, query: { id }, headers: {}, body: {} }
}

function makeRes(): {
  status: jest.Mock
  end: jest.Mock
  json: jest.Mock
  setHeader: jest.Mock
} {
  return {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  }
}

async function call(
  handler: Handler,
  method: string,
  id: string | string[],
): Promise<void> {
  await handler(
    makeReq(method, id) as unknown as Parameters<Handler>[0],
    makeRes() as unknown as Parameters<Handler>[1],
  )
}

beforeEach(() => {
  jest.clearAllMocks()
})

/**
 * `req.query.id` is attacker-controlled: it is whatever sat in the path. All
 * three routes interpolate it straight into the svc-retire URL, so it has to
 * go through sanitizePathParam like every other BFF path parameter — a `..`
 * or an encoded slash would otherwise reach a different backend endpoint
 * with the caller's own bearer token attached.
 */
describe("/api/independence/independence-plans/[id] routes", () => {
  const routes: [string, Handler, string, string][] = [
    ["[id]", planHandler, "PATCH", "http://retire.test/independence-plans/j-1"],
    [
      "[id]/duplicate",
      duplicateHandler,
      "POST",
      "http://retire.test/independence-plans/j-1/duplicate",
    ],
    [
      "[id]/primary",
      primaryHandler,
      "POST",
      "http://retire.test/independence-plans/j-1/primary",
    ],
  ]

  describe.each(routes)("%s", (_name, handler, method, expectedUrl) => {
    it("proxies a clean id to svc-retire", async () => {
      await call(handler, method, "j-1")

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method }),
      )
    })

    it.each([
      ["traversal", "../plans"],
      ["a path separator", "j-1/secrets"],
      ["a backslash", "j-1\\secrets"],
      ["a null byte", "j-1\0"],
    ])("rejects %s without calling the backend", async (_label, id) => {
      await call(handler, method, id)

      expect(mockFetch).not.toHaveBeenCalled()
      const responseWriter = jest.requireMock("@utils/api/responseWriter")
      expect(responseWriter.fetchError).toHaveBeenCalled()
    })

    it("takes the first value when the id arrives repeated", async () => {
      await call(handler, method, ["j-1", "j-2"])

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method }),
      )
    })
  })
})
