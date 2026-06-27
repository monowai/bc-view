import { saveOnboardingExpenses } from "@lib/onboarding/saveIndependenceExpenses"

const categoriesResponse = (
  labels: Array<{ id: string; name: string }>,
): Response =>
  ({
    ok: true,
    json: () =>
      Promise.resolve({
        data: labels.map((l) => ({
          id: l.id,
          name: l.name,
          ownerId: "SYSTEM",
          sortOrder: 0,
        })),
      }),
  }) as unknown as Response

const okResponse = (): Response => ({ ok: true }) as unknown as Response

const errorResponse = (status: number): Response =>
  ({ ok: false, status }) as unknown as Response

describe("saveOnboardingExpenses", () => {
  it("does not POST when the lump sum is zero", async () => {
    const fetchMock = jest.fn()
    await saveOnboardingExpenses("plan-1", 0, "USD", fetchMock)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts the lump sum against the shared Other category id", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        categoriesResponse([
          { id: "housing-1", name: "Housing" },
          { id: "other-99", name: "Other" },
        ]),
      )
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 2500, "SGD", fetchMock)

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/independence/categories")
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe("/api/independence/plans/plan-1/expenses")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({
      categoryLabelId: "other-99",
      categoryName: "Other",
      monthlyAmount: 2500,
      currency: "SGD",
      expensePhase: "RETIREMENT",
    })
  })

  it("falls back to a custom Other label when the category is missing", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        categoriesResponse([{ id: "housing-1", name: "Housing" }]),
      )
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 1000, "USD", fetchMock)

    const [, init] = fetchMock.mock.calls[1]
    expect(JSON.parse(init.body).categoryLabelId).toBe("custom-other")
    expect(JSON.parse(init.body).categoryName).toBe("Other")
  })

  it("falls back to a custom Other label when the categories fetch fails", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 1000, "USD", fetchMock)

    const [, init] = fetchMock.mock.calls[1]
    expect(JSON.parse(init.body).categoryLabelId).toBe("custom-other")
  })

  it("throws when the expense POST returns a non-ok status", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(categoriesResponse([{ id: "other-1", name: "Other" }]))
      .mockResolvedValueOnce(errorResponse(500))

    await expect(
      saveOnboardingExpenses("plan-1", 1000, "USD", fetchMock),
    ).rejects.toThrow("Failed to save onboarding expense: 500")
  })
})
