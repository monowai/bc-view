import { screen } from "@testing-library/react"
import "./testSetup"
import { HEADER_INDICES } from "../Header"
import { mockHoldings } from "../__mocks__/testData"
import { GRANDTOTAL_LAYOUT, TEST_VALUES } from "../constants"
import { renderGrandTotal } from "./testHelpers"

describe("GrandTotal Component", () => {
  beforeEach(() => {
    // Reset viewport size before each test
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  describe("Desktop Layout (xl screens)", () => {
    beforeEach(() => {
      // Set desktop viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1280,
      })
    })

    it("renders all expected columns with correct data mapping", () => {
      renderGrandTotal()

      const tbody = screen.getByRole("rowgroup")
      const dataRow = tbody.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")

      expect(cells).toHaveLength(GRANDTOTAL_LAYOUT.TOTAL_CELLS) // ValueTitle + Spacer + 11 data columns

      // Verify Value Title
      expect(cells![0]).toHaveTextContent(TEST_VALUES.VALUE_TITLE)

      // Verify spacer cell (skips Price column only)
      expect(cells![1]).toHaveAttribute("colSpan", "1")
      expect(cells![1]).toHaveTextContent("")

      // Verify data columns start from position 2 (after ValueTitle + Spacer cells)
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Check that Change is in the first data position (shows gainOnDay sum for mobile)
      expect(dataCells[0]).toHaveTextContent("72.76")

      // Check that gainOnDay (72.76) is in the second data position
      expect(dataCells[1]).toHaveTextContent("72.76")

      // Check that quantity column is empty (no total for quantity)
      expect(dataCells[2]).toHaveAttribute("colSpan", "1")
      expect(dataCells[2]).toHaveTextContent("")

      // Check that cost column has costValue (allow for comma formatting)
      expect(dataCells[3]).toHaveTextContent(/8,?150\.65/)

      // Check marketValue (allow for comma formatting)
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/)

      // Check IRR - hidden in grand total, shows "-" with tooltip
      expect(dataCells[5]).toHaveTextContent("-")

      // Check weight (100.00%) - weight is now at data[9] (swapped with irr)
      expect(dataCells[9]).toHaveTextContent("100.00%")

      // Check totalGain is in the last position (allow for comma formatting) - totalGain is at data[11]
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/)
    })

    it("applies correct responsive classes for desktop", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Change should be visible on desktop (mobile: true)
      expect(dataCells[GRANDTOTAL_LAYOUT.CHANGE_POSITION]).not.toHaveClass(
        "hidden",
      )

      // gainOnDay should be hidden on all screens (hidden: true) - gainOnDay is at data[1]
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).toHaveClass(
        "hidden",
      )
      // No responsive suffix - hidden on all screens including desktop
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).not.toHaveClass(
        "xl:table-cell",
      )

      // marketValue should be visible (mobile: true) - marketValue is at data[4]
      expect(dataCells[4]).not.toHaveClass("hidden")

      // totalGain should be hidden on mobile portrait, visible on landscape+ (mobile: false) - totalGain is at data[11]
      expect(dataCells[11]).toHaveClass("hidden")
      expect(dataCells[11]).toHaveClass("sm:table-cell")
    })

    it("maps data correctly to header indices", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Verify explicit mapping using constants
      // data[0] → HEADER_INDICES.CHANGE (1) - shows gainOnDay sum for mobile visibility
      expect(dataCells[0]).toHaveTextContent("72.76") // change shows gainOnDay sum

      // data[1] → HEADER_INDICES.GAIN_ON_DAY (2)
      expect(dataCells[1]).toHaveTextContent("72.76") // gainOnDay

      // data[2] → HEADER_INDICES.QUANTITY (3) - empty (no total for quantity)
      expect(dataCells[2]).toHaveTextContent("")
      expect(dataCells[2]).toHaveAttribute("colSpan", "1")

      // data[3] → HEADER_INDICES.COST (4) - costValue
      expect(dataCells[3]).toHaveTextContent(/8,?150\.65/)

      // data[4] → HEADER_INDICES.MARKET_VALUE (5)
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/) // marketValue

      // data[5] → HEADER_INDICES.IRR (6) - hidden in grand total
      expect(dataCells[5]).toHaveTextContent("-") // irr hidden, shows dash with tooltip

      // data[9] → HEADER_INDICES.WEIGHT (10) - swapped with irr
      expect(dataCells[9]).toHaveTextContent("100.00%") // weight

      // data[11] → HEADER_INDICES.TOTAL_GAIN (12)
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/) // totalGain
    })

    it("applies correct color coding for gainOnDay", () => {
      const positiveGainHoldings = {
        ...mockHoldings,
        viewTotals: { ...mockHoldings.viewTotals!, gainOnDay: 72.76 },
      }

      renderGrandTotal({ holdings: positiveGainHoldings })

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )
      const gainOnDayCell = dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION] // gainOnDay cell

      // Standard gain color on light background
      expect(gainOnDayCell).toHaveClass("text-emerald-600")
    })
  })

  describe("Mobile Layout (sm screens)", () => {
    beforeEach(() => {
      // Set mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      })
    })

    it("shows change, marketValue, and irr on mobile; weight hidden on portrait", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")

      // Should have all cells: label + spacer + data cells
      expect(cells).toHaveLength(GRANDTOTAL_LAYOUT.TOTAL_CELLS)

      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Change should be visible on mobile (header.mobile = true)
      expect(dataCells[GRANDTOTAL_LAYOUT.CHANGE_POSITION]).not.toHaveClass(
        "hidden",
      )

      // gainOnDay should be hidden on all screens (header.hidden = true)
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).toHaveClass(
        "hidden",
      )
      // No responsive suffix - hidden on all screens including desktop
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).not.toHaveClass(
        "xl:table-cell",
      )

      // quantity column should be hidden on mobile (quantity column: mobile: false) - costValue is at data[2]
      expect(dataCells[2]).toHaveClass("hidden")

      // cost column should be hidden on mobile (cost column: mobile: false) - cost is at data[3]
      expect(dataCells[3]).toHaveClass("hidden")

      // marketValue should be visible on mobile - marketValue is at data[4]
      expect(dataCells[4]).not.toHaveClass("hidden")
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/)

      // IRR should be visible on mobile (mobile: true) - IRR is now at data[5], hidden in grand total
      expect(dataCells[5]).not.toHaveClass("hidden")
      expect(dataCells[5]).toHaveTextContent("-") // IRR hidden, shows dash with tooltip

      // weight should be hidden on mobile portrait, visible on landscape+ (mobile: false) - weight is now at data[9] (swapped with irr)
      expect(dataCells[9]).toHaveClass("hidden")
      expect(dataCells[9]).toHaveClass("sm:table-cell")
      expect(dataCells[9]).toHaveTextContent("100.00%")

      // alpha should be hidden on mobile (mobile: false, medium: false in header) - alpha is at data[10]
      expect(dataCells[10]).toHaveClass("hidden", "xl:table-cell") // alpha column is hidden on mobile

      // totalGain should be hidden on mobile portrait, visible on landscape+ (mobile: false) - totalGain is at data[11]
      expect(dataCells[11]).toHaveClass("hidden")
      expect(dataCells[11]).toHaveClass("sm:table-cell")
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/)
    })

    it("hides Price column skip cell on mobile portrait to prevent column misalignment", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")

      // cells[0] is the Value Title
      // cells[1] is the Price column skip/spacer cell
      const skipCell = cells![1]

      // Skip cell should be hidden on mobile portrait, visible on landscape (640px+)
      // It should have "hidden sm:table-cell" class
      expect(skipCell).toHaveClass("hidden")
      expect(skipCell).toHaveClass("sm:table-cell")
    })

    it("ensures totalGain appears in correct position (not under IRR)", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Weight should be at position 9 (data[9]) and hidden on mobile portrait, visible on landscape+ (mobile: false in header)
      const weightCell = dataCells[9]
      expect(weightCell).toHaveClass("hidden")
      expect(weightCell).toHaveClass("sm:table-cell")

      // totalGain should be at position 11 (data[11]) and hidden on mobile portrait, visible on landscape+ (mobile: false)
      const totalGainCell = dataCells[11]
      expect(totalGainCell).toHaveClass("hidden")
      expect(totalGainCell).toHaveClass("sm:table-cell")
      expect(totalGainCell).toHaveTextContent(/4,?284\.31/)

      // Alpha spacer should be at position 10 (data[10]) and hidden on mobile (mobile: false in header)
      const alphaCell = dataCells[10]
      expect(alphaCell).toHaveClass("hidden", "xl:table-cell")
      expect(alphaCell).toHaveTextContent("") // Empty spacer
    })

    it("maintains proper table structure with weight visible", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Verify the mobile-visible columns maintain their positions
      const visibleColumns = dataCells.filter(
        (cell) =>
          (!cell.classList.contains("hidden") &&
            !cell.classList.contains("md:hidden")) ||
          cell.classList.contains("xl:table-cell"),
      )

      // Should have: change, marketValue, irr, weight + others without hidden classes
      expect(visibleColumns.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe("Column Mapping Verification", () => {
    it("verifies HEADER_INDICES constants match data array mapping", () => {
      renderGrandTotal()

      // Verify constants are correctly defined
      // New order: Price(0), Change(1), GainOnDay(2), Quantity(3), Cost(4), MarketValue(5), IRR(6), Dividends(7), Unrealised(8), Realised(9), Weight(10), Alpha(11), TotalGain(12)
      expect(HEADER_INDICES.GAIN_ON_DAY).toBe(2)
      expect(HEADER_INDICES.COST).toBe(4)
      expect(HEADER_INDICES.MARKET_VALUE).toBe(5)
      expect(HEADER_INDICES.IRR).toBe(6) // swapped with weight
      expect(HEADER_INDICES.DIVIDENDS).toBe(7)
      expect(HEADER_INDICES.WEIGHT).toBe(10) // swapped with irr
      expect(HEADER_INDICES.ALPHA).toBe(11)
      expect(HEADER_INDICES.TOTAL_GAIN).toBe(12)

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Verify data positions match expected values
      expect(dataCells[0]).toHaveTextContent("72.76") // change shows gainOnDay sum at data[0]
      expect(dataCells[1]).toHaveTextContent("72.76") // gainOnDay at data[1]
      expect(dataCells[2]).toHaveTextContent("") // quantity column (empty) at data[2]
      expect(dataCells[3]).toHaveTextContent(/8,?150\.65/) // costValue at data[3]
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/) // marketValue at data[4]
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/) // totalGain at data[11]
    })

    it("verifies multiplier application for percentage values", () => {
      renderGrandTotal()

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // IRR is hidden in grand total - shows "-" with tooltip
      expect(dataCells[5]).toHaveTextContent("-")

      // Weight should show % and be multiplied by 100 - Weight is now at data[9] (swapped with irr)
      expect(dataCells[9]).toHaveTextContent("100.00%") // 1.0 * 100 = 100.00%
    })
  })

  describe("Error Handling", () => {
    it("handles missing viewTotals gracefully", () => {
      const holdingsWithoutTotals = {
        ...mockHoldings,
        viewTotals: undefined,
      } as any

      const { container } = renderGrandTotal({
        holdings: holdingsWithoutTotals,
      })
      // Should return an empty tbody element
      const table = container.querySelector("table")
      const tbody = table?.querySelector("tbody")
      expect(tbody).toBeInTheDocument()
      expect(tbody?.children.length).toBe(0)
    })

    it("handles null gainOnDay value", () => {
      const holdingsWithNullGain = {
        ...mockHoldings,
        viewTotals: {
          ...mockHoldings.viewTotals!,
          gainOnDay: null as any,
        },
      }

      renderGrandTotal({ holdings: holdingsWithNullGain })

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )
      const gainOnDayCell = dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION] // gainOnDay cell

      expect(gainOnDayCell).toHaveTextContent("0.00") // null gainOnDay becomes 0 via ||0, FormatValue now correctly shows 0 values
    })
  })
})
