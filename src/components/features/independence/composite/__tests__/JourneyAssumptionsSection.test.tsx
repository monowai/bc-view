import React from "react"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  type RenderResult,
} from "@testing-library/react"
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

/**
 * Switching journeys is a shallow route push — the section is re-rendered,
 * never remounted. Building the element separately lets a test move
 * `mockActivePlan` and re-render the same tree, which is exactly what the
 * switcher does.
 */
function tree(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): React.ReactElement {
  return (
    <CompositeProjectionProvider value={makeCtx(ctxOverrides)}>
      <JourneyAssumptionsSection />
    </CompositeProjectionProvider>
  )
}

function renderSection(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): RenderResult {
  return render(tree(ctxOverrides))
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

    // The bound is exclusive — 100 itself is refused — so the sentence has to
    // say "less than", not "between", or it reads as a rule it just broke.
    expect(
      screen.getByText(/must be greater than -100% and less than 100%/i),
    ).toBeVisible()
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

  describe("switching the active journey", () => {
    it("shows the journey you switched to, not what you typed under the last one", () => {
      // The switcher is a shallow route push: no remount, so unscoped local
      // state simply carried A's half-typed number onto B's box and claimed
      // it was B's rate.
      const { rerender } = renderSection()

      fireEvent.change(screen.getByLabelText("Fees"), {
        target: { value: "1.1" },
      })
      expect(screen.getByLabelText("Fees")).toHaveValue(1.1)

      mockActivePlan = makeJourney({ id: "j2", feeRate: 0.009 })
      rerender(tree())

      expect(screen.getByLabelText("Fees")).toHaveValue(0.9)
    })

    it("leaves one journey's validation error behind when you switch away", () => {
      const { rerender } = renderSection()

      fireEvent.change(screen.getByLabelText("Fees"), {
        target: { value: "-1" },
      })
      expect(screen.getByText(/fees can't be negative/i)).toBeVisible()

      mockActivePlan = makeJourney({ id: "j2" })
      rerender(tree())

      expect(
        screen.queryByText(/fees can't be negative/i),
      ).not.toBeInTheDocument()
    })

    it("leaves one journey's save failure behind when you switch away", async () => {
      mockUpdate.mockRejectedValue(new Error("Journey is shared with 2 people"))
      const { rerender } = renderSection()

      fireEvent.change(screen.getByLabelText("Fees"), {
        target: { value: "1" },
      })
      act(() => {
        jest.advanceTimersByTime(1000)
      })
      await waitFor(() =>
        expect(
          screen.getByText("Journey is shared with 2 people"),
        ).toBeInTheDocument(),
      )

      mockActivePlan = makeJourney({ id: "j2" })
      rerender(tree())

      expect(
        screen.queryByText("Journey is shared with 2 people"),
      ).not.toBeInTheDocument()
    })

    it("still sends the first journey's queued write, against the first journey", async () => {
      // Typing into B's Fees must not cancel A's pending Fees write: the
      // debounce is per journey AND per field, and A's write belongs to the
      // journey whose box was typed in.
      const { rerender } = renderSection()

      fireEvent.change(screen.getByLabelText("Fees"), {
        target: { value: "1.5" },
      })

      mockActivePlan = makeJourney({ id: "j2", feeRate: 0.009 })
      rerender(tree())

      fireEvent.change(screen.getByLabelText("Fees"), {
        target: { value: "2" },
      })

      act(() => {
        jest.advanceTimersByTime(1000)
      })

      await waitFor(() =>
        expect(mockUpdate).toHaveBeenCalledWith("j1", { feeRate: 0.015 }),
      )
      expect(mockUpdate).toHaveBeenCalledWith("j2", { feeRate: 0.02 })
      expect(mockUpdate).toHaveBeenCalledTimes(2)
    })
  })

  it("points at phasing a first stage when the account has no journey", () => {
    mockActivePlan = undefined
    renderSection()

    expect(screen.queryByLabelText("Equity return")).not.toBeInTheDocument()
    // There is no "create a journey" control anywhere in bc-view; the first
    // journey is minted when a stage is phased. Say that, not "create one".
    expect(
      screen.getByText(/Set up your first stage and phase it/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Create a journey/)).not.toBeInTheDocument()
  })
})
