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

      // Check that Change is in the first data position (empty)
      expect(dataCells[0]).toHaveTextContent("")

      // Check that gainOnDay (72.76) is in the second data position
      expect(dataCells[1]).toHaveTextContent("72.76")

      // Check that costValue is in quantity column only (no span, allow for comma formatting)
      expect(dataCells[2]).toHaveAttribute("colSpan", "1")
      expect(dataCells[2]).toHaveTextContent(/8,?150\.65/)

      // Check that cost column is empty
      expect(dataCells[3]).toHaveTextContent("")

      // Check marketValue (allow for comma formatting)
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/)

      // Check weight (100.00%) - weight is at data[10]
      expect(dataCells[10]).toHaveTextContent("100.00%")

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

      // gainOnDay should be visible on all screens (mobile: true, medium: true) - gainOnDay is at data[1]
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).not.toHaveClass(
        "hidden",
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
      // data[0] → HEADER_INDICES.CHANGE (1)
      expect(dataCells[0]).toHaveTextContent("") // change (empty)

      // data[1] → HEADER_INDICES.GAIN_ON_DAY (2)
      expect(dataCells[1]).toHaveTextContent("72.76") // gainOnDay

      // data[2] → HEADER_INDICES.QUANTITY (3) with costValue
      expect(dataCells[2]).toHaveTextContent(/8,?150\.65/) // costValue in quantity column
      expect(dataCells[2]).toHaveAttribute("colSpan", "1")

      // data[3] → HEADER_INDICES.COST (4) - empty
      expect(dataCells[3]).toHaveTextContent("") // empty cost column

      // data[4] → HEADER_INDICES.MARKET_VALUE (5)
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/) // marketValue

      // data[8] → HEADER_INDICES.IRR (9)
      expect(dataCells[8]).toHaveTextContent("15.00") // irr (15.00 without %)

      // data[10] → HEADER_INDICES.WEIGHT (11)
      expect(dataCells[10]).toHaveTextContent("100.00%") // weight

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

      expect(gainOnDayCell).toHaveClass("text-green-500")
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

    it("shows change, marketValue, alpha (spacer), and totalGain on mobile", () => {
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

      // gainOnDay should be visible on mobile (header.mobile = true, medium = true)
      expect(dataCells[GRANDTOTAL_LAYOUT.GAIN_ON_DAY_POSITION]).not.toHaveClass(
        "hidden",
      )

      // quantity column should be hidden on mobile (quantity column: mobile: false) - costValue is at data[2]
      expect(dataCells[2]).toHaveClass("hidden")

      // cost column should be hidden on mobile (cost column: mobile: false) - cost is at data[3]
      expect(dataCells[3]).toHaveClass("hidden")

      // marketValue should be visible on mobile - marketValue is at data[4]
      expect(dataCells[4]).not.toHaveClass("hidden")
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/)

      // alpha should be hidden on mobile (mobile: false, medium: false in header) - alpha is at data[9]
      expect(dataCells[9]).toHaveClass("hidden", "xl:table-cell") // alpha column is hidden on mobile

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

      // IRR should be at position 8 (data[8]) and visible on mobile (mobile: true in header)
      const irrCell = dataCells[8]
      expect(irrCell).not.toHaveClass("hidden")

      // totalGain should be at position 11 (data[11]) and hidden on mobile portrait, visible on landscape+ (mobile: false)
      const totalGainCell = dataCells[11]
      expect(totalGainCell).toHaveClass("hidden")
      expect(totalGainCell).toHaveClass("sm:table-cell")
      expect(totalGainCell).toHaveTextContent(/4,?284\.31/)

      // Alpha spacer should be at position 9 (data[9]) and hidden on mobile (mobile: false in header)
      const alphaCell = dataCells[9]
      expect(alphaCell).toHaveClass("hidden", "xl:table-cell")
      expect(alphaCell).toHaveTextContent("") // Empty spacer
    })

    it("maintains proper table structure with alpha spacer", () => {
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

      // Should have: gainOnDay, marketValue, alpha (spacer), totalGain + others without hidden classes
      expect(visibleColumns.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe("Column Mapping Verification", () => {
    it("verifies HEADER_INDICES constants match data array mapping", () => {
      renderGrandTotal()

      // Verify constants are correctly defined
      expect(HEADER_INDICES.GAIN_ON_DAY).toBe(2)
      expect(HEADER_INDICES.COST).toBe(4)
      expect(HEADER_INDICES.MARKET_VALUE).toBe(5)
      expect(HEADER_INDICES.IRR).toBe(9)
      expect(HEADER_INDICES.ALPHA).toBe(10)
      expect(HEADER_INDICES.WEIGHT).toBe(11)
      expect(HEADER_INDICES.TOTAL_GAIN).toBe(12)

      const table = screen.getByRole("rowgroup")
      const dataRow = table.querySelector("tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // Verify data positions match expected values
      expect(dataCells[0]).toHaveTextContent("") // change at data[0]
      expect(dataCells[1]).toHaveTextContent("72.76") // gainOnDay at data[1]
      expect(dataCells[2]).toHaveTextContent(/8,?150\.65/) // costValue at data[2]
      expect(dataCells[3]).toHaveTextContent("") // cost column (empty) at data[3]
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

      // IRR should not show % (removed for cleaner appearance) - IRR is at data[8]
      expect(dataCells[8]).toHaveTextContent("15.00") // 0.15 * 100 = 15.00, no %
      expect(dataCells[8]).not.toHaveTextContent("%")

      // Weight should show % and be multiplied by 100 - Weight is at data[10]
      expect(dataCells[10]).toHaveTextContent("100.00%") // 1.0 * 100 = 100.00%
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
      // Should return an empty div, not a tbody element
      const table = container.querySelector("table")
      expect(table?.querySelector("div")).toBeInTheDocument()
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

      expect(gainOnDayCell).toHaveTextContent("") // null gainOnDay becomes 0 via ||0, then FormatValue treats 0 as falsy and shows defaultValue=""
    })
  })
})
