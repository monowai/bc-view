import type { NextApiRequest, NextApiResponse } from "next"
import balanceSeries from "@pages/api/independence/cpf/balance-series"
import policyBalanceSeries from "@pages/api/independence/cpf/policy-balance-series"

jest.mock("@lib/auth0", () => ({
  auth0: {
    getSession: jest.fn().mockResolvedValue({ user: { sub: "u" } }),
    getAccessToken: jest.fn().mockResolvedValue({ token: "t" }),
  },
}))

jest.mock("@utils/api/bcConfig", () => ({
  getRetireUrl: (path: string) => `http://retire${path}`,
}))

function makeRes(): NextApiResponse {
  const res = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }
  return res as unknown as NextApiResponse
}

describe("cpf series routes", () => {
  const mockFetch = jest.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve("{}"),
      headers: new Headers({ "content-type": "application/json" }),
    })
    global.fetch = mockFetch
  })

  it.each([
    ["/cpf/balance-series", balanceSeries],
    ["/cpf/policy-balance-series", policyBalanceSeries],
  ])(
    "should forward %s with array params folded to the first value",
    async (path, handler) => {
      const req = {
        method: "GET",
        headers: {},
        query: { salary: ["100", "200"], age: "40", skip: undefined },
      } as unknown as NextApiRequest

      await handler(req, makeRes())

      expect(mockFetch.mock.calls[0][0]).toBe(
        `http://retire${path}?salary=100&age=40`,
      )
    },
  )

  it("should reject a non-GET", async () => {
    const res = makeRes()
    const req = {
      method: "POST",
      headers: {},
      query: {},
    } as unknown as NextApiRequest

    await balanceSeries(req, res)

    expect(res.status).toHaveBeenCalledWith(405)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
