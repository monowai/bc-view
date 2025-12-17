import React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import SummaryHeader, { SummaryRow, SummaryRowMobile } from "../Summary"
import { Portfolio, PortfolioSummary } from "types/beancounter"

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

const mockPortfolio: Portfolio = {
  id: "test-portfolio",
  code: "TEST",
  name: "Test Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
  base: { code: "USD", name: "US Dollar", symbol: "$" },
  marketValue: 10000,
  irr: 0.1,
}

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
      // SummaryRowMobile is rendered outside table for mobile/tablet views
      const { container } = render(<SummaryRowMobile {...mockSummary} />)

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
      // SummaryRowMobile is rendered outside table for mobile/tablet views
      const { container } = render(<SummaryRowMobile {...mockSummary} />)

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
      // SummaryRowMobile is rendered outside table for mobile/tablet views
      const { container } = render(<SummaryRowMobile {...mockSummary} />)

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
      // SummaryRowMobile is rendered outside table for mobile/tablet views
      const { container } = render(<SummaryRowMobile {...mockSummary} />)

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

  describe("Desktop View (width >= 1280px)", () => {
    beforeEach(() => {
      // Mock desktop viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1920,
      })
    })

    it("should render summary values on the same row as the As At date picker in desktop mode", () => {
      const { container } = render(
        <table>
          <SummaryHeader
            portfolio={mockPortfolio}
            portfolioSummary={mockSummary}
          />
          <SummaryRow />
        </table>,
      )

      // Get the thead element
      const thead = container.querySelector("thead")
      expect(thead).toBeInTheDocument()

      // Get all rows in thead
      const theadRows = thead?.querySelectorAll("tr")
      expect(theadRows?.length).toBe(2) // Should have exactly 2 rows

      // Second row should contain BOTH the date picker AND the summary values
      const secondRow = theadRows?.[1]
      expect(secondRow).toBeInTheDocument()

      // Should contain the date picker
      const dateInput = secondRow?.querySelector('input[type="date"]')
      expect(dateInput).toBeInTheDocument()

      // Should NOT have a separate tbody with values (values should be in the header row)
      const tbody = container.querySelector("tbody")
      const tbodyRows = tbody?.querySelectorAll("tr")

      // tbody should either not exist or should be empty (no value rows)
      // The values should be in cells of the second thead row
      if (tbody && tbodyRows) {
        // If tbody exists, it should not contain the summary value row
        const hasValueCells = Array.from(tbodyRows).some((row) => {
          const cells = row.querySelectorAll("td")
          return cells.length > 1 // Value rows have multiple cells
        })
        expect(hasValueCells).toBe(false)
      }

      // The second header row should have multiple cells (date + values)
      const secondRowCells = secondRow?.querySelectorAll("td, th")
      expect(secondRowCells?.length).toBeGreaterThan(1)
    })

    it("should display As At date with same font size and bold styling as the values", () => {
      const { container } = render(
        <table>
          <SummaryHeader
            portfolio={mockPortfolio}
            portfolioSummary={mockSummary}
          />
          <SummaryRow />
        </table>,
      )

      const thead = container.querySelector("thead")
      const theadRows = thead?.querySelectorAll("tr")
      const secondRow = theadRows?.[1]

      // Get the date cell (first cell in second row)
      const dateCell = secondRow?.querySelector("td")
      expect(dateCell).toBeInTheDocument()

      // Date cell should have matching font size classes as value cells
      expect(dateCell).toHaveClass("text-xs")
      expect(dateCell).toHaveClass("md:text-sm")

      // Date cell should be bold/medium weight to match values
      const hasFontWeight =
        dateCell?.classList.contains("font-bold") ||
        dateCell?.classList.contains("font-medium")
      expect(hasFontWeight).toBe(true)
    })
  })
})
