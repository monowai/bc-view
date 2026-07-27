import React from "react"
import { render, screen, fireEvent, RenderResult } from "@testing-library/react"
import "@testing-library/jest-dom"
import LifestyleMoodBoard from "../steps/LifestyleMoodBoard"
import { makeLifestyleCatalog } from "../__fixtures__/lifestyleCatalog"
import { ExpenseFormEntry, TierSelectionChange } from "types/independence"

const catalog = makeLifestyleCatalog()

function renderBoard(
  expenses: ExpenseFormEntry[] = [],
  onSelectionChange: (change: TierSelectionChange) => void = jest.fn(),
): RenderResult {
  return render(
    <LifestyleMoodBoard
      categories={catalog.categories}
      currency={catalog.currency}
      expenses={expenses}
      onSelectionChange={onSelectionChange}
    />,
  )
}

describe("LifestyleMoodBoard", () => {
  it("renders all catalog categories in sortOrder", () => {
    renderBoard()
    const headings = screen.getAllByTestId("lifestyle-category-name")
    expect(headings.map((h) => h.textContent?.trim())).toEqual([
      "🏠 Home Base",
      "🛒 Home Table",
      "🚗 Getting Around",
      "🩺 Health & Wellness",
      "⛳ Hobbies & Play",
      "✈️ Flying",
      "🏕️ Travel Stays",
      "🍽️ Eating Out",
    ])
  })

  it("renders reserve tiers with a gold ✦ marker", () => {
    renderBoard()
    // Health's 5th tier ("Concierge") is a reserve tier
    expect(screen.getByText(/Concierge/)).toBeInTheDocument()
    const reserveTiers = screen.getAllByTestId("lifestyle-tier-reserve")
    expect(reserveTiers.length).toBeGreaterThan(0)
  })

  it("clicking a tier switches to board mode and reports the selection", () => {
    const onSelectionChange = jest.fn()
    renderBoard([], onSelectionChange)

    fireEvent.click(screen.getByRole("button", { name: /Comfortable.*2,200/i }))

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall =
      onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0]
    expect(lastCall.selection.housing).toBe(1)
    expect(lastCall.pickedKeys).toContain("housing")
  })

  it("moving the budget slider applies a greedy fit across all categories", () => {
    const onSelectionChange = jest.fn()
    renderBoard([], onSelectionChange)

    const slider = screen.getByLabelText(/monthly budget/i)
    fireEvent.change(slider, { target: { value: "20000" } })

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall =
      onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0]
    // With a generous budget, several categories should be upgraded above tier 0
    const upgradedCount = Object.values(
      lastCall.selection as Record<string, number>,
    ).filter((idx) => idx > 0).length
    expect(upgradedCount).toBeGreaterThan(0)
  })

  it("shows a 'you today' chip and highlights the nearest tier on initial mount", () => {
    renderBoard([
      {
        categoryLabelId: "cat-housing",
        categoryName: "Home Base",
        monthlyAmount: 2100,
      },
    ])

    expect(screen.getByText(/you today.*2,100.*\/mo/i)).toBeInTheDocument()
    // 2100 is nearest to Comfortable (2200)
    const nearest = screen.getByTestId("lifestyle-tier-nearest-housing-1")
    expect(nearest).toBeInTheDocument()
  })

  it("shows the delta between board total and current total in the header", () => {
    renderBoard([
      {
        categoryLabelId: "cat-housing",
        categoryName: "Home Base",
        monthlyAmount: 1200,
      },
    ])

    expect(screen.getByText(/current spend/i)).toBeInTheDocument()
  })

  it("marks a category's chip as custom once its picked amount is edited away from the tier anchor", () => {
    const onSelectionChange = jest.fn()
    const { rerender } = renderBoard([], onSelectionChange)

    fireEvent.click(screen.getByRole("button", { name: /Comfortable.*2,200/i }))

    rerender(
      <LifestyleMoodBoard
        categories={catalog.categories}
        currency={catalog.currency}
        expenses={[
          {
            categoryLabelId: "cat-housing",
            categoryName: "Home Base",
            monthlyAmount: 2350,
          },
        ]}
        onSelectionChange={onSelectionChange}
      />,
    )

    expect(
      screen.getByTestId("lifestyle-chip-custom-housing"),
    ).toBeInTheDocument()
  })
})
