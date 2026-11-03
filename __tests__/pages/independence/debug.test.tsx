import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

let mockPlansResult: {
  data?: { data: unknown[]; sharedPlanIds?: string[] }
  isLoading: boolean
}
let mockHoldingsLoading = false
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) =>
    key.includes("plans")
      ? mockPlansResult
      : {
          data: { data: { positions: {} } },
          isLoading: mockHoldingsLoading,
        },
}))
jest.mock("@utils/api/fetchHelper", () => ({
  simpleFetcher: () => jest.fn(),
  holdingKey: () => "/api/holdings/aggregated/today",
}))
jest.mock("@utils/api/client/independence", () => ({
  plansKey: "/api/independence/plans",
  projectionKey: (id: string) => `/api/independence/projection/${id}`,
}))

let mockAssets: {
  hasAssets: boolean
  liquidAssets: number
  nonSpendableAssets: number
}
jest.mock("@components/features/independence", () => ({
  useAssetBreakdown: () => mockAssets,
}))
let mockSettings: Record<string, unknown> | undefined
jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({ settings: mockSettings }),
}))

import DebugPage from "@pages/independence/debug"

const Page = DebugPage as React.ComponentType<Record<string, unknown>>

const basePlan = {
  id: "p1",
  name: "Primary Plan",
  isPrimary: true,
  expensesCurrency: "NZD",
  monthlyExpenses: 4000,
  pensionMonthly: 1000,
  socialSecurityMonthly: 500,
  otherIncomeMonthly: 0,
  equityReturnRate: 0.07,
  inflationRate: 0.02,
}
const otherPlan = { ...basePlan, id: "p2", name: "Other", isPrimary: false }

const projectionBody = {
  data: {
    liquidAssets: 123000,
    fiMetrics: {
      fiProgress: 60,
      retirementAgeFiProgress: 90,
      bridgeProgress: 40,
      incomeCoverageAtRetirement: 30,
      gapToFi: 50000,
      bridgeYears: 4.5,
      bridgeYearsNeeded: 7,
      totalMonthlyIncome: 1500,
      fiNumber: 1000000,
      netMonthlyExpenses: 2500,
      pvGuaranteedIncomeToday: 20000,
    },
    planInputs: {
      blendedReturnRate: 0.05,
      rentalIncomeMonthly: 200,
      yearOfBirth: 1975,
      lifeExpectancy: 88,
      retirementAge: 62,
    },
    debug: {
      callerOwnerId: "caller-1",
      planOwnerId: "owner-1",
      planSystemUserId: null,
      ownerScopedFetch: true,
      resolvedInputs: {
        liquidAssets: 1,
        rentalIncomeMonthly: 2,
        pensionConfigCount: 3,
        cpfLifeMonthlyTotal: 4,
      },
      resolution: { holdings: "owner-m2m" },
    },
  },
}

const mockFetch = jest.fn()

// The page seeds its selection when the plans list *arrives*, so render
// first with the list still loading and then deliver it.
function renderWithPlansArriving(): void {
  const arrived = mockPlansResult
  mockPlansResult = { data: undefined, isLoading: true }
  const view = render(<Page />)
  mockPlansResult = arrived
  view.rerender(<Page />)
}

function lastBody(): Record<string, unknown> {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return JSON.parse(call[1].body)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockHoldingsLoading = false
  mockPlansResult = {
    data: { data: [otherPlan, basePlan] },
    isLoading: false,
  }
  mockAssets = { hasAssets: true, liquidAssets: 250000, nonSpendableAssets: 9 }
  mockSettings = { yearOfBirth: 1980, lifeExpectancy: 92 }
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(projectionBody),
  })
  global.fetch = mockFetch as unknown as typeof fetch
})

describe("independence debug page", () => {
  it("tells the user when there are no plans", () => {
    mockPlansResult = { data: { data: [] }, isLoading: false }
    render(<Page />)
    expect(screen.getByText("No plans found. Create one first.")).toBeVisible()
  })

  it("shows a spinner while plans load", () => {
    mockPlansResult = { data: undefined, isLoading: true }
    render(<Page />)
    expect(screen.getByText("Loading plans…")).toBeInTheDocument()
    expect(
      screen.queryByText("No plans found. Create one first."),
    ).not.toBeInTheDocument()
  })

  it("selects the primary plan and seeds local metrics from settings and holdings", async () => {
    renderWithPlansArriving()
    expect(await screen.findByRole("combobox")).toHaveValue("p1")
    expect(screen.getByText("Primary Plan ★")).toBeInTheDocument()
    const year = new Date().getFullYear()
    expect(screen.getAllByText(String(year - 1980)).length).toBeGreaterThan(0)
    // fiNumber local = (4000-1500)*12*25
    expect(screen.getAllByText("NZD 750,000").length).toBeGreaterThan(0)
    expect(screen.getByText("Money (NZD)")).toBeInTheDocument()
  })

  it("posts the viewer's ages and holdings for an owned plan and shows backend metrics", async () => {
    renderWithPlansArriving()
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), {
      timeout: 3000,
    })
    expect(mockFetch.mock.calls[0][0]).toBe("/api/independence/projection/p1")
    const body = lastBody()
    expect(body).toMatchObject({
      currency: "NZD",
      monthlyExpenses: 4000,
      liquidAssets: 250000,
      nonSpendableAssets: 9,
      includeDebug: true,
    })
    expect(body.currentAge).toBeDefined()
    expect(await screen.findByText("60.0%")).toBeInTheDocument()
    expect(screen.getByText("Resolved Inputs")).toBeInTheDocument()
    expect(screen.getByText("Owner-scoped (M2M)")).toBeInTheDocument()
    expect(screen.getByText("resolution.holdings:")).toBeInTheDocument()
    expect(screen.getByText("Last Request Body")).toBeInTheDocument()
    expect(screen.getAllByText("5.00%").length).toBeGreaterThan(0)
    expect(screen.getByText("4.5y")).toBeInTheDocument()
  })

  it("re-posts with the edited value when a slider moves", async () => {
    renderWithPlansArriving()
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), {
      timeout: 3000,
    })
    const callsBefore = mockFetch.mock.calls.length
    const sliders = screen.getAllByRole("slider")
    // Monthly expenses is the 5th slider.
    fireEvent.change(sliders[4], { target: { value: "5200" } })
    await waitFor(
      () => expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore),
      { timeout: 3000 },
    )
    expect(lastBody().monthlyExpenses).toBe(5200)
  })

  it("omits viewer-scoped fields for a shared plan and flags none as leaks", async () => {
    mockPlansResult = {
      data: { data: [basePlan], sharedPlanIds: ["p1"] },
      isLoading: false,
    }
    mockAssets = { hasAssets: false, liquidAssets: 0, nonSpendableAssets: 0 }
    renderWithPlansArriving()
    await waitFor(() => expect(mockFetch).toHaveBeenCalled(), {
      timeout: 3000,
    })
    const body = lastBody()
    expect(body).not.toHaveProperty("currentAge")
    expect(body).not.toHaveProperty("liquidAssets")
    expect(body).not.toHaveProperty("nonSpendableAssets")
    expect(
      await screen.findByText("Shared plan — viewer-scoped fields are leaks"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^🚨/)).not.toBeInTheDocument()
    // Re-seeded from the projection echo (owner's retirement age).
    await waitFor(() =>
      expect(screen.getAllByText("62").length).toBeGreaterThan(0),
    )
  })

  it("does not call the backend for an owned plan without holdings", async () => {
    mockAssets = { hasAssets: false, liquidAssets: 0, nonSpendableAssets: 0 }
    renderWithPlansArriving()
    await new Promise((r) => setTimeout(r, 500))
    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("shows the failure when the projection endpoint errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    })
    renderWithPlansArriving()
    expect(
      await screen.findByText("Projection failed: 502", {}, { timeout: 3000 }),
    ).toBeVisible()
  })

  it("stringifies a non-Error rejection", async () => {
    mockFetch.mockRejectedValue("kaput")
    renderWithPlansArriving()
    expect(
      await screen.findByText("kaput", {}, { timeout: 3000 }),
    ).toBeVisible()
  })

  it("clears the previous projection when another plan is chosen", async () => {
    renderWithPlansArriving()
    await screen.findByText("60.0%", {}, { timeout: 3000 })
    mockFetch.mockImplementation(() => new Promise(() => {}))
    await userEvent.selectOptions(screen.getByRole("combobox"), "p2")
    expect(screen.getByRole("combobox")).toHaveValue("p2")
    expect(screen.queryByText("Resolved Inputs")).not.toBeInTheDocument()
  })

  it("falls back to default ages when neither plan nor settings know them", async () => {
    mockSettings = undefined
    mockPlansResult = { data: { data: [basePlan] }, isLoading: false }
    renderWithPlansArriving()
    expect(await screen.findByRole("combobox")).toBeInTheDocument()
    // default current age 50, life expectancy 90
    expect(screen.getAllByText("50").length).toBeGreaterThan(0)
    expect(screen.getAllByText("90").length).toBeGreaterThan(0)
  })

  it("reports no local PV or bridge when there is no guaranteed income", async () => {
    mockPlansResult = {
      data: {
        data: [
          {
            ...basePlan,
            pensionMonthly: 0,
            socialSecurityMonthly: 0,
            monthlyExpenses: 0,
          },
        ],
      },
      isLoading: false,
    }
    mockFetch.mockImplementation(() => new Promise(() => {}))
    renderWithPlansArriving()
    await screen.findByRole("combobox")
    // 100% coverage, local metrics absent for option A/B
    expect(screen.getAllByText(/local —/).length).toBeGreaterThan(0)
  })
})
