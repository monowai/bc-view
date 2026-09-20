import { generatePhasedPlans } from "@lib/onboarding/generatePhasedPlans"

const okResponse = (): Response => ({ ok: true }) as unknown as Response

const errorResponse = (status: number): Response =>
  ({ ok: false, status }) as unknown as Response

/** A rejection that carries a body, the way the BFF actually answers. */
const errorResponseWithBody = (status: number, body: string): Response =>
  ({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  }) as unknown as Response

describe("generatePhasedPlans", () => {
  it("does not POST when the plan id is empty", async () => {
    const fetchMock = jest.fn()
    await generatePhasedPlans("", true, fetchMock)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("defaults to force so a stale composite is overwritten", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse())

    await generatePhasedPlans("plan-1", undefined, fetchMock)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/independence/plans/plan-1/phases")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({ force: true })
  })

  it("passes force: false so an existing composite is not clobbered", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(okResponse())

    await generatePhasedPlans("plan-1", false, fetchMock)

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ force: false })
  })

  it("throws when the phases POST returns a non-ok status", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(errorResponse(400))

    await expect(
      generatePhasedPlans("plan-1", true, fetchMock),
    ).rejects.toThrow("Failed to generate phased plans: 400")
  })

  it("throws the backend's own reason when the rejection carries one", async () => {
    // svc-retire refuses phasing without a date of birth or a target age, and
    // that sentence is the only thing telling the user what to do next.
    const fetchMock = jest.fn().mockResolvedValueOnce(
      errorResponseWithBody(
        400,
        JSON.stringify({
          message:
            "Set a target independence age or year of birth before generating phases",
        }),
      ),
    )

    await expect(
      generatePhasedPlans("plan-1", false, fetchMock),
    ).rejects.toThrow(
      "Set a target independence age or year of birth before generating phases",
    )
  })
})
