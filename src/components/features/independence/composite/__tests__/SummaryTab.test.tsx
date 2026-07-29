import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

jest.mock("@components/features/independence/usePlanExpenses", () => ({
  usePlanExpenses: () => ({ expenses: [], isLoading: false }),
}))

jest.mock("@components/features/independence/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ labels: {} }),
}))

jest.mock("@components/features/independence/useLifestyleCatalog", () => ({
  useLifestyleCatalog: () => ({ catalog: null }),
}))

// The board itself is covered by LifestyleSummary.test.tsx. Here we only care
// that each phase gets a title and its own action slot.
jest.mock("@components/features/independence/LifestyleSummary", () => ({
  __esModule: true,
  default: ({
    title,
    action,
  }: {
    title?: string
    action?: React.ReactNode
  }): React.ReactElement => (
    <div data-testid="lifestyle-summary">
      <span>{title}</span>
      {action}
    </div>
  ),
}))

import SummaryTab from "../tabs/SummaryTab"

const projection = {
  phases: [
    {
      planId: "p1",
      planName: "Go-Go",
      fromAge: 61,
      toAge: 70,
      expensesCurrency: "SGD",
    },
    {
      planId: "p2",
      planName: "Slow Go",
      fromAge: 70,
      toAge: 80,
      expensesCurrency: "SGD",
    },
  ],
} as unknown as CompositeProjectionValue["projection"]

function renderWithCtx(
  overrides: Partial<CompositeProjectionValue> = {},
): void {
  const ctx = {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    compositeWorkScenarioId: undefined,
    setCompositeWorkScenarioId: jest.fn(),
    projection,
    scenarios: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  } as CompositeProjectionValue
  render(
    <CompositeProjectionProvider value={ctx}>
      <SummaryTab />
    </CompositeProjectionProvider>,
  )
}

describe("SummaryTab", () => {
  it("gives each phase an edit link to that phase's plan", () => {
    renderWithCtx()

    const goGo = screen.getByRole("link", { name: /Edit Go-Go/i })
    expect(goGo).toHaveAttribute("href", "/independence/wizard/p1")

    const slowGo = screen.getByRole("link", { name: /Edit Slow Go/i })
    expect(slowGo).toHaveAttribute("href", "/independence/wizard/p2")
  })

  it("renders one board per phase, titled with its age window", () => {
    renderWithCtx()

    expect(screen.getAllByTestId("lifestyle-summary")).toHaveLength(2)
    expect(screen.getByText("Go-Go · age 61–70")).toBeInTheDocument()
    expect(screen.getByText("Slow Go · age 70–80")).toBeInTheDocument()
  })

  it("shows no edit links when there are no phases", () => {
    renderWithCtx({
      projection: {
        phases: [],
      } as unknown as CompositeProjectionValue["projection"],
    })

    expect(
      screen.queryByRole("link", { name: /Edit/i }),
    ).not.toBeInTheDocument()
  })
})
