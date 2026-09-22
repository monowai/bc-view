import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase, RetirementPlan } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("next/router", () => ({
  useRouter: () => ({ asPath: "/independence?view=stages" }),
}))

const mockSetInherits = jest.fn().mockResolvedValue(undefined)
jest.mock("@hooks/useStageRateSource", () => ({
  useStageRateSource: () => ({
    setInherits: mockSetInherits,
    isSaving: () => false,
    errorFor: () => undefined,
  }),
}))

// Stub ResidencePhasePicker — its own hook wiring is covered by
// ResidencePhasePicker.test.tsx; here we only assert PhasesTab renders it.
jest.mock("../ResidencePhasePicker", () => ({
  __esModule: true,
  default: (): React.ReactElement => (
    <div data-testid="residence-phase-picker">ResidencePhasePicker stub</div>
  ),
}))

// Stub BenefitsStartPhasePicker — its own hook wiring is covered by
// BenefitsStartPhasePicker.test.tsx; here we only assert PhasesTab renders it.
jest.mock("../BenefitsStartPhasePicker", () => ({
  __esModule: true,
  default: (): React.ReactElement => (
    <div data-testid="benefits-start-phase-picker">
      BenefitsStartPhasePicker stub
    </div>
  ),
}))

import PhasesTab from "../tabs/PhasesTab"

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 65, toAge: 75 },
  { planId: "p2", fromAge: 75 },
]

const defaultPlans = [
  { id: "p1", name: "Go-Go" },
  { id: "p2", name: "Slow Go" },
] as RetirementPlan[]

const echoProjection = {
  phases: [
    {
      planId: "p1",
      planName: "Go-Go",
      fromAge: 65,
      toAge: 75,
      expensesCurrency: "USD",
      assumptions: {
        source: "STAGE",
        cashReturnRate: 0.03,
        equityReturnRate: 0.07,
        housingReturnRate: 0.04,
        inflationRate: 0.025,
        feeRate: 0,
        investmentTaxRate: 0,
      },
    },
    {
      planId: "p2",
      planName: "Slow Go",
      fromAge: 75,
      toAge: 90,
      expensesCurrency: "USD",
      assumptions: {
        source: "MIXED",
        cashReturnRate: 0.03,
        equityReturnRate: 0.07,
        housingReturnRate: 0.04,
        inflationRate: 0.025,
        feeRate: 0,
        investmentTaxRate: 0,
      },
    },
  ],
} as CompositeProjectionValue["projection"]

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: defaultPlans,
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: {
      result: null,
      isRunning: false,
      error: null,
      run: jest.fn(),
    },
    ...overrides,
  }
}

function renderWithCtx(
  ctxOverrides: Partial<CompositeProjectionValue> = {},
): void {
  const ctx = makeCtx(ctxOverrides)
  render(
    <CompositeProjectionProvider value={ctx}>
      <PhasesTab />
    </CompositeProjectionProvider>,
  )
}

describe("PhasesTab", () => {
  beforeEach(() => {})

  it("opens on the first stage, with its provenance and rates read from the echo", () => {
    renderWithCtx({ projection: echoProjection })

    const drawer = screen.getByRole("region", { name: "Go-Go stage" })
    expect(drawer).toBeInTheDocument()
    expect(screen.getByText("Own assumptions")).toBeInTheDocument()
    expect(screen.getAllByRole("definition")).toHaveLength(6)
    expect(screen.getByText("4%")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Go-Go/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    )
  })

  it("claims no provenance when the projection carries no echo", () => {
    // Never derived client-side: no echo means nothing is claimed.
    renderWithCtx()

    expect(screen.queryByText("Own assumptions")).not.toBeInTheDocument()
    expect(screen.queryByText("Inherits from journey")).not.toBeInTheDocument()
    expect(
      screen.getByText("Rates show once the projection has run."),
    ).toBeInTheDocument()
  })

  it("switches the drawer to the stage that was pressed", () => {
    renderWithCtx({ projection: echoProjection })

    fireEvent.click(screen.getByRole("button", { name: /^Slow Go/ }))

    expect(
      screen.getByRole("region", { name: "Slow Go stage" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Mixed")).toBeInTheDocument()
    expect(
      screen.queryByRole("region", { name: "Go-Go stage" }),
    ).not.toBeInTheDocument()
  })

  it("moves a seam for both stages that share it", () => {
    const setPhases = jest.fn()
    renderWithCtx({ setPhases })

    fireEvent.change(screen.getByLabelText("Slow Go starts at age"), {
      target: { value: "78" },
    })

    // An updater over the prior list, so a burst of edits never drops one.
    const [update] = setPhases.mock.calls[0]
    expect(update(defaultPhases)).toEqual([
      { planId: "p1", fromAge: 65, toAge: 78 },
      { planId: "p2", fromAge: 78 },
    ])
  })

  it("moves the open stage later and follows it", () => {
    const setPhases = jest.fn()
    renderWithCtx({ setPhases })

    fireEvent.click(screen.getByRole("button", { name: "Move Go-Go later" }))

    const [update] = setPhases.mock.calls[0]
    expect(update(defaultPhases)).toEqual([
      { planId: "p2", fromAge: 65, toAge: 75 },
      { planId: "p1", fromAge: 75 },
    ])
    // The drawer now sits on index 1 — which, in this render's unchanged
    // context, is still "Slow Go"; what matters is that it followed.
    expect(
      screen.getByRole("region", { name: "Slow Go stage" }),
    ).toBeInTheDocument()
  })

  it("flips a stage's rate source from its drawer", () => {
    renderWithCtx({
      plans: [
        { id: "p1", name: "Go-Go", assumptionsInherited: true },
        { id: "p2", name: "Slow Go", assumptionsInherited: false },
      ] as RetirementPlan[],
    })

    fireEvent.click(screen.getByRole("switch", { name: "Own rates for Go-Go" }))

    expect(mockSetInherits).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      false,
    )
  })

  it("renders one responsive layout, not duplicated desktop/mobile copies", () => {
    renderWithCtx()
    expect(screen.getAllByTestId("phases-layout")).toHaveLength(1)
    expect(screen.getAllByRole("region", { name: /stage$/ })).toHaveLength(1)
  })

  it("carries no composite narrative field — narrative lives on each phase plan", () => {
    renderWithCtx()
    expect(document.querySelector("textarea")).toBeNull()
    expect(screen.queryByText(/Plan narrative/i)).not.toBeInTheDocument()
  })

  it("carries each age once: on the band's seams, never again in the drawer inputs", () => {
    renderWithCtx()
    expect(screen.getByLabelText("Go-Go starts at age")).toHaveValue("65")
    expect(screen.getByLabelText("Slow Go starts at age")).toHaveValue("75")
    expect(screen.getAllByRole("textbox")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Go-Go 10 yr" }),
    ).toBeInTheDocument()
  })

  it("teaches the empty state when nothing is included", () => {
    renderWithCtx({ phases: [] })
    expect(screen.getByText("No stages yet")).toBeInTheDocument()
  })

  it("resolves the open-ended last phase from the projection horizon", () => {
    renderWithCtx({
      projection: {
        phases: [
          {
            planId: "p1",
            planName: "Go-Go",
            fromAge: 65,
            toAge: 75,
            expensesCurrency: "USD",
          },
          {
            planId: "p2",
            planName: "Slow Go",
            fromAge: 75,
            toAge: 90,
            expensesCurrency: "USD",
          },
        ],
      } as CompositeProjectionValue["projection"],
    })
    expect(screen.getByText("to 90")).toBeInTheDocument()
  })

  it("groups both phase levers in a single panel", () => {
    renderWithCtx()
    expect(screen.getByTestId("phase-levers")).toBeInTheDocument()
    expect(screen.getAllByTestId("residence-phase-picker")).toHaveLength(1)
    expect(screen.getAllByTestId("benefits-start-phase-picker")).toHaveLength(1)
  })

  it("hides the levers panel when there are no phases to hang them off", () => {
    renderWithCtx({ phases: [] })
    expect(screen.queryByTestId("phase-levers")).not.toBeInTheDocument()
  })

  it("shows a spinner while the projection is calculating", () => {
    renderWithCtx({ isLoading: true })
    expect(
      screen.getByText(/Calculating composite projection/i),
    ).toBeInTheDocument()
  })

  it("shows an error alert when error is set", () => {
    renderWithCtx({ error: "Something went wrong" })
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })
})
