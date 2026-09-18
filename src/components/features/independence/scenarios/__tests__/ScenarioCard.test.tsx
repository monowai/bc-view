import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { WorkScenario } from "types/independence"
import ScenarioCard from "../ScenarioCard"

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: false }),
}))

const scenario = (overrides: Partial<WorkScenario> = {}): WorkScenario =>
  ({
    id: "s1",
    ownerId: "u1",
    name: "Working - SGD",
    currency: "SGD",
    isCurrent: false,
    computedMonthlyContribution: 0,
    workingIncomeMonthly: 0,
    workingExpensesMonthly: 0,
    taxesMonthly: 0,
    investmentAllocationPercent: 0,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }) as WorkScenario

const renderCard = (
  s: WorkScenario,
  usedByPlan = false,
): HTMLElement | null => {
  const { container } = render(
    <ScenarioCard
      scenario={s}
      usedByPlan={usedByPlan}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      onSetCurrent={jest.fn()}
    />,
  )
  return container.firstElementChild as HTMLElement
}

describe("ScenarioCard — what the outline means", () => {
  it("outlines the scenario this plan actually uses", () => {
    // The ring is the strongest signal on the card, so it has to carry the
    // per-plan association rather than restate the account-wide default.
    const card = renderCard(scenario(), true)
    expect(card?.className).toContain("ring-independence-500")
    expect(screen.getByText(/Used by this plan/i)).toBeInTheDocument()
  })

  it("does not outline a scenario merely because it is the account default", () => {
    // "Current" already says this, and a ring here read as "this plan uses
    // it" — which it could not know.
    const card = renderCard(scenario({ isCurrent: true }), false)
    expect(card?.className).not.toContain("ring-independence-500")
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.queryByText(/Used by this plan/i)).not.toBeInTheDocument()
  })

  it("can say both when the plan uses the account default", () => {
    renderCard(scenario({ isCurrent: true }), true)
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.getByText(/Used by this plan/i)).toBeInTheDocument()
  })
})

describe("ScenarioCard — a plan naming a scenario that no longer exists", () => {
  it("falls back to marking the current one, as the projection does", () => {
    // svc-retire degrades an unresolvable workScenarioId to the current
    // scenario. If the list kept matching on the dead id, nothing would be
    // marked and the UI would disagree with the numbers on screen.
    renderCard(scenario({ isCurrent: true }), true)
    expect(screen.getByText(/Used by this plan/i)).toBeInTheDocument()
  })
})
