import {
  createCsvExportHandler,
  createCsvImportHandler,
} from "@utils/api/csvHandlers"

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

jest.mock("@utils/api/responseWriter", () => ({
  __esModule: true,
  default: jest.fn(),
  fetchError: jest.fn(
    (
      _req: unknown,
      res: { status: jest.Mock; json: jest.Mock },
      error: { message: string },
    ) => {
      res.status(500).json({ error: error.message })
    },
  ),
  hasError: jest.fn((response: { status: number }) => response.status >= 400),
  handleErrors: jest.fn(),
}))

interface Req {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
  body?: Record<string, unknown>
}

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
  send: jest.Mock
  end: jest.Mock
}

function makeReq(method = "GET", body?: Record<string, unknown>): Req {
  return { method, query: {}, headers: {}, body }
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
  }
}

function mockFetchResponse(
  body: unknown,
  status = 200,
  text?: string,
): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text ?? ""),
  } as unknown as Response
}

beforeEach(() => {
  jest.clearAllMocks()
})

const UPSTREAM_URL = "http://data.test/test/export"
const IMPORT_URL = "http://data.test/test/import"
const FILENAME = "test.csv"

describe("createCsvExportHandler", () => {
  const handler = createCsvExportHandler(UPSTREAM_URL, FILENAME)

  it("returns 405 for non-GET methods", async () => {
    const req = makeReq("POST")
    const res = makeRes()

    await handler(
      req as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Allow", ["GET"])
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.end).toHaveBeenCalledWith("Method POST Not Allowed")
  })

  it("returns 401 when no session", async () => {
    const { auth0 } = jest.requireMock("@lib/auth0")
    auth0.getSession.mockResolvedValueOnce(null)

    const req = makeReq("GET")
    const res = makeRes()

    await handler(
      req as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: "Not authenticated" })
  })

  it("returns 200 with CSV content, correct Content-Type and Content-Disposition", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockFetchResponse(null, 200, "col1,col2\nval1,val2"),
      ) as unknown as typeof fetch

    const req = makeReq("GET")
    const res = makeRes()

    await handler(
      req as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    )

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv")
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      `attachment; filename="${FILENAME}"`,
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.send).toHaveBeenCalledWith("col1,col2\nval1,val2")
  })
})

describe("createCsvImportHandler", () => {
  const handler = createCsvImportHandler(IMPORT_URL, FILENAME)

  it("returns 400 when csvContent is missing", async () => {
    const req = makeReq("POST", {})
    const res = makeRes()

    await handler(
      req as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: "No CSV content provided" })
  })

  it("returns 200 JSON passthrough on success", async () => {
    const responsePayload = { data: { id: "asset-1" } }
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockFetchResponse(responsePayload, 200),
      ) as unknown as typeof fetch

    const req = makeReq("POST", { csvContent: "col1,col2\nval1,val2" })
    const res = makeRes()

    await handler(
      req as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1],
    )

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(responsePayload)
  })
})
