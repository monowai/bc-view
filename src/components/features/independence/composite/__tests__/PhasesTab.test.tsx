import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase, RetirementPlan } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

// Records the props the stage list is handed — what provenance it is given
// is the whole question in "passes the projection's assumption sources" below.
const mockPhaseConfigList = jest.fn()

const mockPhaseConfigListStub = (
  props: Record<string, unknown>,
): React.ReactElement => {
  mockPhaseConfigList(props)
  return <div data-testid="phase-config-list">PhaseConfigList stub</div>
}

// Stub PhaseConfigList so we can assert it renders without dragging in
// MathInput / DOM measurement issues.
jest.mock(
  "@components/features/independence/composite/../PhaseConfigList",
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>): React.ReactElement =>
      mockPhaseConfigListStub(props),
  }),
)

// PhaseConfigList is imported relative from PhasesTab — also cover the
// relative path the module resolver will use.
jest.mock("../../PhaseConfigList", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>): React.ReactElement =>
    mockPhaseConfigListStub(props),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
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
  beforeEach(() => {
    mockPhaseConfigList.mockClear()
  })

  it("hands the stage list each phase's assumption source from the projection echo", () => {
    renderWithCtx({
      projection: {
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
      } as CompositeProjectionValue["projection"],
    })

    expect(mockPhaseConfigList).toHaveBeenCalledWith(
      expect.objectContaining({
        assumptionSources: { p1: "STAGE", p2: "MIXED" },
      }),
    )
  })

  it("hands over an empty record when the projection carries no echo", () => {
    // Never derived client-side: no echo means nothing is claimed.
    renderWithCtx()

    expect(mockPhaseConfigList).toHaveBeenCalledWith(
      expect.objectContaining({ assumptionSources: {} }),
    )
  })

  it("skips phases the echo left without an assumptions block", () => {
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
        ],
      } as CompositeProjectionValue["projection"],
    })

    expect(mockPhaseConfigList).toHaveBeenCalledWith(
      expect.objectContaining({ assumptionSources: {} }),
    )
  })

  it("renders one responsive layout, not duplicated desktop/mobile copies", () => {
    renderWithCtx()
    expect(screen.getAllByTestId("phases-layout")).toHaveLength(1)
    expect(screen.getAllByTestId("phase-config-list")).toHaveLength(1)
  })

  it("carries no composite narrative field — narrative lives on each phase plan", () => {
    renderWithCtx()
    expect(document.querySelector("textarea")).toBeNull()
    expect(screen.queryByText(/Plan narrative/i)).not.toBeInTheDocument()
  })

  it("renders the timeline band with each phase's span", () => {
    renderWithCtx()
    expect(screen.getByText("Timeline")).toBeInTheDocument()
    expect(screen.getByText(/65–75 · 10 yr/)).toBeInTheDocument()
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
    expect(screen.getByText(/age 65 → 90 · 25 years/)).toBeInTheDocument()
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
