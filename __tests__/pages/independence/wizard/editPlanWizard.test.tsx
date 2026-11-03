import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

let mockQuery: Record<string, string | string[] | undefined> = {}
jest.mock("next/router", () => ({
  useRouter: () => ({ query: mockQuery }),
}))
jest.mock("next/head", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let mockSwr: { data?: unknown; error?: unknown; isLoading?: boolean }
const mockSwrCalls: unknown[][] = []
jest.mock("swr", () => ({
  __esModule: true,
  default: (...args: unknown[]) => {
    mockSwrCalls.push(args)
    return mockSwr
  },
}))
jest.mock("@utils/api/fetchHelper", () => ({ simpleFetcher: () => jest.fn() }))

const mockWizard = jest.fn()
jest.mock("@components/features/independence/WizardContainer", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockWizard(props)
    return <div data-testid="wizard" />
  },
}))

import EditPlanWizardPage from "@pages/independence/wizard/[planId]"

const Page = EditPlanWizardPage as React.ComponentType<Record<string, unknown>>

const plan = {
  id: "p1",
  name: "Stage One",
  updatedDate: "2026-02-01",
  expensesCurrency: "SGD",
  pensionMonthly: 100,
  cashReturnRate: 0.02,
  equityReturnRate: 0.07,
  inflationRate: 0.025,
  cashAllocation: 0.2,
  equityAllocation: 0.8,
  housingAllocation: 0,
}

function initialData(): Record<string, unknown> {
  return mockWizard.mock.calls[mockWizard.mock.calls.length - 1][0]
    .initialData as Record<string, unknown>
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSwrCalls.length = 0
  mockQuery = { planId: "p1" }
  mockSwr = { data: { plan, expenses: [] }, isLoading: false }
})

describe("edit plan wizard page", () => {
  it("shows a loading state while the plan loads", () => {
    mockSwr = { isLoading: true }
    render(<Page />)
    expect(screen.getByText("Loading plan...")).toBeInTheDocument()
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument()
  })

  it("does not fetch until the route supplies a plan id", () => {
    mockQuery = {}
    render(<Page />)
    expect(screen.getByText("Loading plan...")).toBeInTheDocument()
    expect(mockSwrCalls[0][0]).toBeNull()
  })

  it("shows an error when the plan cannot be loaded", () => {
    mockSwr = { error: new Error("x"), isLoading: false }
    render(<Page />)
    expect(screen.getByText(/Failed to load plan/)).toBeInTheDocument()
  })

  it("shows an error when no data arrives", () => {
    mockSwr = { data: undefined, isLoading: false }
    render(<Page />)
    expect(screen.getByText(/Failed to load plan/)).toBeInTheDocument()
  })

  it("opens the wizard on the requested step with a way back to the stage", () => {
    mockQuery = {
      planId: "p1",
      step: "personal",
      returnTo: "/independence/plans/p1",
    }
    render(<Page />)
    expect(screen.getByText("Edit Stage One")).toBeInTheDocument()
    const back = screen.getByText("Back to this stage").closest("a")
    expect(back).toHaveAttribute("href", "/independence/plans/p1")
    expect(mockWizard).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "p1",
        initialStep: 1,
        plan: expect.objectContaining({ id: "p1" }),
      }),
    )
  })

  it("falls back to step one and the plan surface for unknown tokens", () => {
    mockQuery = {
      planId: "p1",
      step: "bogus",
      returnTo: "https://evil.example",
    }
    render(<Page />)
    expect(screen.getByText("Back to your plan").closest("a")).toHaveAttribute(
      "href",
      "/independence",
    )
    expect(mockWizard.mock.calls[0][0].initialStep).toBeUndefined()
  })

  it("converts stored decimals to percentages and applies defaults", () => {
    mockSwr = {
      data: {
        plan: { ...plan, housingReturnRate: undefined, country: "SG" },
        expenses: [
          { categoryLabelId: "c1", categoryName: "Food", monthlyAmount: 500 },
        ],
      },
    }
    render(<Page />)
    const d = initialData()
    expect(d).toMatchObject({
      planName: "Stage One",
      expensesCurrency: "SGD",
      country: "SG",
      pensionMonthly: 100,
      cashReturnRate: 2,
      equityReturnRate: 7,
      housingReturnRate: 4,
      inflationRate: 2.5,
      cashAllocation: 20,
      equityAllocation: 80,
      assumptionsInherited: false,
      expenses: [
        { categoryLabelId: "c1", categoryName: "Food", monthlyAmount: 500 },
      ],
    })
    expect(d.manualAssets).toEqual({
      CASH: 0,
      EQUITY: 0,
      ETF: 0,
      MUTUAL_FUND: 0,
      RE: 0,
    })
  })

  it("accepts manual assets, life events and disposals as objects or JSON", () => {
    const disposal = { assetId: "a", disposalAge: 70 }
    const event = { name: "Gift", age: 60 }
    mockSwr = {
      data: {
        plan: {
          ...plan,
          manualAssets: { CASH: 5 },
          lifeEvents: [event],
          assetDisposals: JSON.stringify([disposal]),
        },
      },
    }
    render(<Page />)
    const d = initialData()
    expect(d.manualAssets).toMatchObject({ CASH: 5, EQUITY: 0 })
    expect(d.lifeEvents).toEqual([event])
    expect(d.assetDisposals).toEqual([disposal])
  })

  it("parses JSON strings for stored assets and life events", () => {
    mockSwr = {
      data: {
        plan: {
          ...plan,
          manualAssets: JSON.stringify({ EQUITY: 9 }),
          lifeEvents: JSON.stringify([{ name: "Gift" }]),
          assetDisposals: [{ assetId: "z" }],
        },
      },
    }
    render(<Page />)
    const d = initialData()
    expect(d.manualAssets).toMatchObject({ EQUITY: 9 })
    expect(d.lifeEvents).toEqual([{ name: "Gift" }])
    expect(d.assetDisposals).toEqual([{ assetId: "z" }])
  })

  it("tolerates unparseable stored JSON", () => {
    mockSwr = {
      data: {
        plan: {
          ...plan,
          manualAssets: "{broken",
          lifeEvents: "{broken",
          assetDisposals: "{broken",
        },
      },
    }
    render(<Page />)
    const d = initialData()
    expect(d.manualAssets).toMatchObject({ CASH: 0 })
    expect(d.lifeEvents).toEqual([])
    expect(d.assetDisposals).toEqual([])
  })
})
