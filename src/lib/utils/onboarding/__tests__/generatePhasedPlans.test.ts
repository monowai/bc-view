import { generatePhasedPlans } from "@lib/onboarding/generatePhasedPlans"

const okResponse = (): Response => ({ ok: true }) as unknown as Response

const errorResponse = (status: number): Response =>
  ({ ok: false, status }) as unknown as Response

describe("generatePhasedPlans", () => {
  it("does not POST when the plan id is empty", async () => {
    const fetchMock = jest.fn()
    await generatePhasedPlans("", fetchMock)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts to the plan's phases endpoint with force so a stale composite is overwritten", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse())

    await generatePhasedPlans("plan-1", fetchMock)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/independence/plans/plan-1/phases")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ force: true })
  })

  it("throws when the phases POST returns a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(errorResponse(400))

    await expect(generatePhasedPlans("plan-1", fetchMock)).rejects.toThrow(
      "Failed to generate phased plans: 400",
    )
  })
})
