import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { IndependencePlan } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

const mockUpdate = jest.fn()
let mockActivePlan: IndependencePlan | undefined

jest.mock("@hooks/useIndependencePlans", () => ({
  useActiveIndependencePlan: () => ({
    plans: mockActivePlan ? [mockActivePlan] : [],
    activePlan: mockActivePlan,
    activePlanId: mockActivePlan?.id,
    update: mockUpdate,
    isLoading: false,
  }),
}))

import JourneyAssumptionsSection from "../tabs/JourneyAssumptionsSection"

function makeJourney(
  overrides: Partial<IndependencePlan> = {},
): IndependencePlan {
  return {
    id: "j1",
    ownerId: "u1",
    name: "Main journey",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    cashReturnRate: 0.025,
    equityReturnRate: 0.07,
    housingReturnRate: 0.035,
    inflationRate: 0.02,
    feeRate: 0.004,
    investmentTaxRate: 0.15,
    ...overrides,
  }
}

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: { result: null, isRunning: false, error: null, run: jest.fn() },
    ...overrides,
  } as CompositeProjectionValue
}

function renderSection(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): void {
  render(
    <CompositeProjectionProvider value={makeCtx(ctxOverrides)}>
      <JourneyAssumptionsSection />
    </CompositeProjectionProvider>,
  )
}

/** Phase echo shorthand — the provenance list reads only `source`. */
function phase(
  planId: string,
  planName: string,
  source: "JOURNEY" | "STAGE" | "MIXED",
): unknown {
  return {
    planId,
    planName,
    fromAge: 60,
    toAge: 75,
    expensesCurrency: "USD",
    assumptions: {
      source,
      cashReturnRate: 0.025,
      equityReturnRate: 0.07,
      housingReturnRate: 0.035,
      inflationRate: 0.02,
      feeRate: 0.004,
      investmentTaxRate: 0.15,
    },
  }
}

describe("JourneyAssumptionsSection", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockUpdate.mockReset().mockResolvedValue(undefined)
    mockActivePlan = makeJourney()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it("seeds every rate as a percentage of the journey's stored decimal", () => {
    renderSection()

    expect(screen.getByLabelText("Cash return")).toHaveValue(2.5)
    expect(screen.getByLabelText("Equity return")).toHaveValue(7)
    expect(screen.getByLabelText("Housing return")).toHaveValue(3.5)
    expect(screen.getByLabelText("Inflation")).toHaveValue(2)
    expect(screen.getByLabelText("Fees")).toHaveValue(0.4)
    expect(screen.getByLabelText("Investment tax")).toHaveValue(15)
  })

  it("leaves a rate the journey has never stated empty, and says what happens then", () => {
    mockActivePlan = makeJourney({ housingReturnRate: undefined })
    renderSection()

    const housing = screen.getByLabelText("Housing return")
    expect(housing).toHaveValue(null)
    expect(housing).toHaveAttribute("placeholder", "Each stage uses its own")
  })

  it("says plainly that stages inherit these unless they override", () => {
    renderSection()

    expect(
      screen.getByText(/every stage inherits these unless it overrides/i),
    ).toBeInTheDocument()
  })

  it("saves one field per PATCH, as a decimal, after the debounce", async () => {
    renderSection()

    fireEvent.change(screen.getByLabelText("Equity return"), {
      target: { value: "6.5" },
    })
    expect(mockUpdate).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("j1", {
        equityReturnRate: 0.065,
      }),
    )
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it("calls off the queued write when a later keystroke is invalid", () => {
    renderSection()

    const equity = screen.getByLabelText("Equity return")
    fireEvent.change(equity, { target: { value: "6" } })
    fireEvent.change(equity, { target: { value: "" } })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("refuses a rate the backend would reject, and saves nothing", () => {
    renderSection()

    fireEvent.change(screen.getByLabelText("Inflation"), {
      target: { value: "100" },
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/must be between -100% and 100%/i)).toBeVisible()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("allows a negative return but not a negative fee", () => {
    renderSection()

    fireEvent.change(screen.getByLabelText("Equity return"), {
      target: { value: "-2" },
    })
    fireEvent.change(screen.getByLabelText("Fees"), {
      target: { value: "-1" },
    })

    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalledWith("j1", { equityReturnRate: -0.02 })
    expect(screen.getByText(/fees can't be negative/i)).toBeVisible()
  })

  it("surfaces the backend's own reason when a save fails", async () => {
    mockUpdate.mockRejectedValue(new Error("Journey is shared with 2 people"))
    renderSection()

    fireEvent.change(screen.getByLabelText("Fees"), { target: { value: "1" } })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    await waitFor(() =>
      expect(
        screen.getByText("Journey is shared with 2 people"),
      ).toBeInTheDocument(),
    )
  })

  it("lists each stage's provenance from the projection echo", () => {
    renderSection({
      projection: {
        phases: [
          phase("p1", "Go-Go", "JOURNEY"),
          phase("p2", "Slow Go", "STAGE"),
          phase("p3", "No-Go", "MIXED"),
        ],
      } as CompositeProjectionValue["projection"],
    })

    expect(screen.getByText("Go-Go")).toBeInTheDocument()
    expect(screen.getByText("Inherits from journey")).toBeInTheDocument()
    expect(screen.getByText("Own assumptions")).toBeInTheDocument()
    expect(screen.getByText("Mixed")).toBeInTheDocument()
  })

  it("claims nothing about provenance when there is no echo to read", () => {
    renderSection()

    expect(screen.queryByText("Inherits from journey")).not.toBeInTheDocument()
    expect(
      screen.queryByText(/which stages use these/i),
    ).not.toBeInTheDocument()
  })

  it("asks for a journey first when the account has none", () => {
    mockActivePlan = undefined
    renderSection()

    expect(screen.queryByLabelText("Equity return")).not.toBeInTheDocument()
  })
})
