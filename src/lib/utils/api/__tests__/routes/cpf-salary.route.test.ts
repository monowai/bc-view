import previewHandler from "@pages/api/independence/cpf/contribution-preview"
import definedContributionHandler from "@pages/api/independence/projection/defined-contribution"

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

function makeReq(query: Record<string, string>): {
  method: string
  query: Record<string, string>
  headers: Record<string, string>
} {
  return { method: "GET", query, headers: {} }
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

beforeEach(() => {
  jest.clearAllMocks()
})

type Handler = typeof previewHandler

async function call(
  handler: Handler,
  query: Record<string, string>,
): Promise<void> {
  await handler(
    makeReq(query) as unknown as Parameters<Handler>[0],
    makeRes() as unknown as Parameters<Handler>[1],
  )
}

/** svc-retire restates CPF's SGD limits in the salary's currency (svc-retire #348). */
describe("CPF salary routes", () => {
  it("contribution-preview forwards the salary currency", async () => {
    await call(previewHandler, {
      monthlySalary: "9000",
      age: "35",
      currency: "NZD",
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/cpf/contribution-preview?monthlySalary=9000&age=35&currency=NZD",
      expect.any(Object),
    )
  })

  it("contribution-preview defaults to SGD", async () => {
    await call(previewHandler, { monthlySalary: "9000", age: "35" })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/cpf/contribution-preview?monthlySalary=9000&age=35&currency=SGD",
      expect.any(Object),
    )
  })

  it("defined-contribution forwards the salary currency", async () => {
    await call(definedContributionHandler, {
      salary: "9000",
      age: "35",
      currency: "NZD",
    })

    expect(mockFetch).toHaveBeenCalledWith(
      "http://retire.test/projection/defined-contribution?salary=9000&age=35&currency=NZD",
      expect.any(Object),
    )
  })
})
