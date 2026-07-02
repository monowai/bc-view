import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

// Stub PhaseConfigList so we can assert it renders without dragging in
// MathInput / DOM measurement issues.
jest.mock(
  "@components/features/independence/composite/../PhaseConfigList",
  () => ({
    __esModule: true,
    default: (): React.ReactElement => (
      <div data-testid="phase-config-list">PhaseConfigList stub</div>
    ),
  }),
)

// PhaseConfigList is imported relative from PhasesTab — also cover the
// relative path the module resolver will use.
jest.mock("../../PhaseConfigList", () => ({
  __esModule: true,
  default: (): React.ReactElement => (
    <div data-testid="phase-config-list">PhaseConfigList stub</div>
  ),
}))

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

import PhasesTab from "../tabs/PhasesTab"

const defaultPhases: CompositePhase[] = [
  { planId: "p1", fromAge: 65, toAge: 90 },
]

function makeCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): CompositeProjectionValue {
  return {
    plans: [],
    phases: defaultPhases,
    setPhases: jest.fn(),
    displayCurrency: "USD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeNarrative: "My plan narrative",
    setCompositeNarrative: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection: undefined,
    scenarios: undefined,
    isLoading: false,
    error: null,
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
  it("renders the desktop layout container", () => {
    renderWithCtx()
    expect(screen.getByTestId("phases-desktop-layout")).toBeInTheDocument()
  })

  it("desktop layout contains the narrative textarea with id=composite-narrative", () => {
    renderWithCtx()
    const desktopLayout = screen.getByTestId("phases-desktop-layout")
    // The desktop textarea sits inside the desktop layout div.
    const desktopTextarea = desktopLayout.querySelector(
      "textarea#composite-narrative",
    )
    expect(desktopTextarea).toBeInTheDocument()
  })

  it("renders the mobile layout container", () => {
    renderWithCtx()
    expect(screen.getByTestId("phases-mobile-layout")).toBeInTheDocument()
  })

  it("mobile layout contains its own narrative textarea with unique id", () => {
    renderWithCtx()
    const mobileLayout = screen.getByTestId("phases-mobile-layout")
    const mobileTextarea = mobileLayout.querySelector(
      "textarea#composite-narrative-mobile",
    )
    expect(mobileTextarea).toBeInTheDocument()
  })

  it("both textarea ids are present in the document and are different", () => {
    renderWithCtx()
    const desktopTextarea = document.getElementById("composite-narrative")
    const mobileTextarea = document.getElementById("composite-narrative-mobile")

    expect(desktopTextarea).toBeInTheDocument()
    expect(mobileTextarea).toBeInTheDocument()
    expect(desktopTextarea?.id).not.toBe(mobileTextarea?.id)
  })

  it("both textareas reflect the compositeNarrative value from context", () => {
    renderWithCtx({ compositeNarrative: "Phase narrative text" })

    const allTextareas = screen.getAllByPlaceholderText(
      /Overarching goal across all phases/i,
    )
    // One from desktop layout, one from mobile flip card
    expect(allTextareas).toHaveLength(2)
    allTextareas.forEach((ta) => {
      expect(ta).toHaveValue("Phase narrative text")
    })
  })

  it("renders PhaseConfigList in both desktop and mobile layouts", () => {
    renderWithCtx()
    const stubs = screen.getAllByTestId("phase-config-list")
    // desktop layout + mobile flip card (front face)
    expect(stubs.length).toBeGreaterThanOrEqual(2)
  })

  it("mobile layout contains a FlipCard flip-card-inner element", () => {
    renderWithCtx()
    const mobileLayout = screen.getByTestId("phases-mobile-layout")
    const inner = mobileLayout.querySelector("[data-testid='flip-card-inner']")
    expect(inner).toBeInTheDocument()
  })

  it("shows an error alert when error is set", () => {
    renderWithCtx({ error: "Something went wrong" })
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("shows a spinner when isLoading is true", () => {
    renderWithCtx({ isLoading: true })
    // Spinner renders a visually-hidden label; check for it
    expect(
      screen.getByText(/Calculating composite projection/i),
    ).toBeInTheDocument()
  })
})
