import { renderHook } from "@testing-library/react"
import { useIndependencePlanData } from "../useIndependencePlanData"
import useSwr from "swr"

jest.mock("swr")

const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const makePlan = (overrides = {}) => ({
  id: "plan-1",
  name: "Retirement",
  monthlyExpenses: 3000,
  expensesCurrency: "NZD",
  yearOfBirth: 1980,
  lifeExpectancy: 90,
  planningHorizonYears: 25,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.02,
  cashAllocation: 0.2,
  equityAllocation: 0.6,
  housingAllocation: 0.2,
  pensionMonthly: 500,
  socialSecurityMonthly: 0,
  otherIncomeMonthly: 0,
  ...overrides,
})

// Helper to build the SWR mock for each call index
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildSwrMock(calls: Record<number, Partial<ReturnType<typeof useSwr>>>) {
  let callIndex = 0
  mockUseSwr.mockImplementation(() => {
    const idx = callIndex++
    const base = {
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useSwr>
    return { ...base, ...(calls[idx] || {}) } as ReturnType<typeof useSwr>
  })
}

describe("useIndependencePlanData", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
  })

  it("returns loading state when plan is not yet loaded", () => {
    buildSwrMock({
      0: { data: undefined, isLoading: true },
    })
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.plan).toBeUndefined()
    expect(result.current.isClientPlan).toBe(false)
  })

  it("returns plan data when loaded", () => {
    const plan = makePlan()
    buildSwrMock({
      0: { data: { data: plan } },
    })
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.plan).toEqual(plan)
  })

  it("returns plan error when fetch fails", () => {
    const err = new Error("Not found")
    buildSwrMock({
      0: { error: err },
    })
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.planError).toBe(err)
  })

  it("detects client plans by clientId", () => {
    const plan = makePlan({ clientId: "client-123" })
    buildSwrMock({
      0: { data: { data: plan } },
    })
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.isClientPlan).toBe(true)
  })

  it("returns quick scenarios from SWR", () => {
    const scenarios = [{ id: "s1", name: "Bear Market" }]
    buildSwrMock({
      0: { data: { data: makePlan() } },
      1: {}, // portfolios
      2: {}, // holdings
      3: { data: { data: scenarios } }, // scenarios
      4: {}, // currencies
    })
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.quickScenarios).toEqual(scenarios)
  })

  it("returns empty arrays when no data", () => {
    buildSwrMock({})
    const { result } = renderHook(() => useIndependencePlanData("plan-1"))

    expect(result.current.quickScenarios).toEqual([])
    expect(result.current.availableCurrencies).toEqual([])
  })

  it("skips SWR calls when id is undefined", () => {
    buildSwrMock({})
    renderHook(() => useIndependencePlanData(undefined))

    // First call should have null key (plan)
    expect(mockUseSwr.mock.calls[0][0]).toBeNull()
  })
})
