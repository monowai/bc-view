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

const systemLabels = [
  { id: "housing-1", name: "Housing" },
  { id: "other-99", name: "Other" },
  { id: "health-7", name: "Healthcare" },
]

describe("saveOnboardingExpenses", () => {
  it("does not fetch or POST when both amounts are zero", async () => {
    const fetchMock = jest.fn()
    await saveOnboardingExpenses("plan-1", 0, 0, "USD", fetchMock)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("posts the general amount under Other and the medical amount under Healthcare", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(categoriesResponse(systemLabels))
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 2500, 300, "SGD", fetchMock)

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/independence/categories")
    const general = JSON.parse(fetchMock.mock.calls[1][1].body)
    const medical = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(general).toEqual({
      categoryLabelId: "other-99",
      categoryName: "Other",
      monthlyAmount: 2500,
      currency: "SGD",
      expensePhase: "RETIREMENT",
    })
    expect(medical).toEqual({
      categoryLabelId: "health-7",
      categoryName: "Healthcare",
      monthlyAmount: 300,
      currency: "SGD",
      expensePhase: "RETIREMENT",
    })
  })

  it("posts only the medical row when the general amount is zero", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(categoriesResponse(systemLabels))
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 0, 300, "USD", fetchMock)

    const expensePosts = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/expenses"),
    )
    expect(expensePosts).toHaveLength(1)
    expect(JSON.parse(expensePosts[0][1].body).categoryName).toBe("Healthcare")
  })

  it("falls back to custom labels when the seeded categories are missing", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        categoriesResponse([{ id: "housing-1", name: "Housing" }]),
      )
      .mockResolvedValueOnce(okResponse())
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 1000, 200, "USD", fetchMock)

    expect(JSON.parse(fetchMock.mock.calls[1][1].body).categoryLabelId).toBe(
      "custom-other",
    )
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).categoryLabelId).toBe(
      "custom-healthcare",
    )
  })

  it("falls back to custom labels when the categories fetch fails", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(okResponse())

    await saveOnboardingExpenses("plan-1", 1000, 0, "USD", fetchMock)

    expect(JSON.parse(fetchMock.mock.calls[1][1].body).categoryLabelId).toBe(
      "custom-other",
    )
  })

  it("throws, naming the category, when an expense POST returns a non-ok status", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(categoriesResponse(systemLabels))
      .mockResolvedValueOnce(errorResponse(500))

    await expect(
      saveOnboardingExpenses("plan-1", 1000, 0, "USD", fetchMock),
    ).rejects.toThrow("Failed to save onboarding expense (Other): 500")
  })
})
