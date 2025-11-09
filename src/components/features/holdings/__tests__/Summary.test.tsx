import React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SummaryRow } from "../Summary"
import { PortfolioSummary } from "types/beancounter"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Mock the holdingState hook
jest.mock("@lib/holdings/holdingState", () => ({
  useHoldingState: () => ({
    asAt: new Date("2024-01-01"),
    setAsAt: jest.fn(),
  }),
}))

const mockSummary: PortfolioSummary = {
  totals: {
    marketValue: 12643.74,
    purchases: 8150.65,
    sales: 1000.0,
    cash: 500.0,
    income: 299.02,
    gain: 4284.31,
    irr: 0.15,
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
  },
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
}

describe("Summary Mobile View Tests (TDD)", () => {
  describe("Mobile View (width < 768px)", () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      })
      Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: 667,
      })
    })

    it("should hide Purchases and Income sections in mobile view", () => {
      const { container } = render(
        <table>
          <SummaryRow {...mockSummary} />
        </table>,
      )

      // Find the sections in the horizontal card (mobile layout)
      // The mobile layout uses a grid with 3 columns on mobile, 4 on tablet
      const gridContainer = container.querySelector(".grid")
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer).toHaveClass("grid-cols-3")
      expect(gridContainer).toHaveClass("md:grid-cols-4")

      // Get all the text-center divs
      const columns = gridContainer?.querySelectorAll(".text-center")

      // The Purchases column should not exist (removed entirely)
      const purchasesColumn = Array.from(columns || []).find((col) =>
        col.textContent?.includes("summary.purchases"),
      )
      expect(purchasesColumn).toBeUndefined()

      // The Income column should exist but be hidden on mobile, shown on tablet
      const incomeColumn = Array.from(columns || []).find((col) =>
        col.textContent?.includes("summary.dividends"),
      )
      expect(incomeColumn).toBeInTheDocument()
      expect(incomeColumn).toHaveClass("hidden")
      expect(incomeColumn).toHaveClass("md:block")
    })

    it("should show columns in order: Value, Income, Gain, IRR", () => {
      const { container } = render(
        <table>
          <SummaryRow {...mockSummary} />
        </table>,
      )

      const gridContainer = container.querySelector(".grid")
      const columns = gridContainer?.querySelectorAll(".text-center")

      // Verify we have 4 columns
      expect(columns).toHaveLength(4)

      // Verify the order: Value (visible), Income (hidden), Gain (visible), IRR (visible)
      const columnLabels = Array.from(columns || []).map(
        (col) => col.querySelector(".text-gray-500")?.textContent,
      )

      expect(columnLabels[0]).toBe("summary.value")
      expect(columnLabels[1]).toBe("summary.dividends")
      expect(columnLabels[2]).toBe("summary.gain")
      expect(columnLabels[3]).toBe("summary.irr")
    })
  })

  describe("Tablet View (width >= 768px)", () => {
    beforeEach(() => {
      // Mock tablet viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      })
    })

    it("should show Income instead of Purchases in tablet view", () => {
      const { container } = render(
        <table>
          <SummaryRow {...mockSummary} />
        </table>,
      )

      // Find the sections in the horizontal card
      const gridContainer = container.querySelector(".grid")
      expect(gridContainer).toHaveClass("grid-cols-3")
      expect(gridContainer).toHaveClass("md:grid-cols-4")

      const columns = gridContainer?.querySelectorAll(".text-center")

      // Purchases should not exist
      const purchasesColumn = Array.from(columns || []).find((col) =>
        col.textContent?.includes("summary.purchases"),
      )
      expect(purchasesColumn).toBeUndefined()

      // Income should exist and be shown on tablet
      const incomeColumn = Array.from(columns || []).find((col) =>
        col.textContent?.includes("summary.dividends"),
      )
      expect(incomeColumn).toBeInTheDocument()
      expect(incomeColumn).toHaveClass("hidden")
      expect(incomeColumn).toHaveClass("md:block")
    })

    it("should show all summary fields in correct order in tablet view", () => {
      const { container } = render(
        <table>
          <SummaryRow {...mockSummary} />
        </table>,
      )

      const gridContainer = container.querySelector(".grid")
      const columns = gridContainer?.querySelectorAll(".text-center")

      // Verify we have 4 columns
      expect(columns).toHaveLength(4)

      // Verify the order: Value, Income, Gain, IRR
      const columnLabels = Array.from(columns || []).map(
        (col) => col.querySelector(".text-gray-500")?.textContent,
      )

      expect(columnLabels[0]).toBe("summary.value")
      expect(columnLabels[1]).toBe("summary.dividends")
      expect(columnLabels[2]).toBe("summary.gain")
      expect(columnLabels[3]).toBe("summary.irr")
    })
  })
})
