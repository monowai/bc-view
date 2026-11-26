import definedContributionHandler from "@pages/api/independence/projection/defined-contribution"
import contributionPreviewHandler from "@pages/api/independence/cpf/contribution-preview"

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
    fetchError: jest.fn(),
  }
})

jest.mock("@utils/api/bcConfig", () => ({
  getRetireUrl: (path: string): string => `http://retire.test${path}`,
}))

const mockFetch = jest
  .fn()
  .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({}) })
global.fetch = mockFetch as unknown as typeof fetch

type Handler = typeof definedContributionHandler

async function call(
  handler: Handler,
  query: Record<string, string | string[]>,
): Promise<string> {
  const req = { method: "GET", query, headers: {} }
  const res = {
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  }
  await handler(
    req as unknown as Parameters<Handler>[0],
    res as unknown as Parameters<Handler>[1],
  )
  return mockFetch.mock.calls[0][0] as string
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe("CPF preview routes forward the salary currency", () => {
  describe("/api/independence/projection/defined-contribution", () => {
    it("should forward the supplied currency", async () => {
      expect(
        await call(definedContributionHandler, {
          salary: "5000",
          age: "40",
          currency: "NZD",
        }),
      ).toBe(
        "http://retire.test/projection/defined-contribution?salary=5000&age=40&currency=NZD",
      )
    })

    it("should default the currency to SGD when omitted", async () => {
      expect(
        await call(definedContributionHandler, { salary: "5000", age: "40" }),
      ).toBe(
        "http://retire.test/projection/defined-contribution?salary=5000&age=40&currency=SGD",
      )
    })

    it("should fold array params to their first value and encode them", async () => {
      expect(
        await call(definedContributionHandler, {
          salary: ["5000", "9000"],
          age: "40&x=1",
          currency: ["NZD", "USD"],
        }),
      ).toBe(
        "http://retire.test/projection/defined-contribution?salary=5000&age=40%26x%3D1&currency=NZD",
      )
    })
  })

  describe("/api/independence/cpf/contribution-preview", () => {
    it("should forward the supplied currency", async () => {
      expect(
        await call(contributionPreviewHandler, {
          monthlySalary: "5000",
          age: "40",
          currency: "NZD",
        }),
      ).toBe(
        "http://retire.test/cpf/contribution-preview?monthlySalary=5000&age=40&currency=NZD",
      )
    })

    it("should default the currency to SGD when omitted", async () => {
      expect(
        await call(contributionPreviewHandler, {
          monthlySalary: "5000",
          age: "40",
        }),
      ).toBe(
        "http://retire.test/cpf/contribution-preview?monthlySalary=5000&age=40&currency=SGD",
      )
    })
  })
})
