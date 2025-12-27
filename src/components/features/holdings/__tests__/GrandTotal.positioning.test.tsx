import "./testSetup"
import { HEADER_INDICES } from "../Header"
import { mockHoldings } from "../__mocks__/testData"
import { renderGrandTotal } from "./testHelpers"

describe("GrandTotal Column Positioning Tests", () => {
  describe("Desktop Layout", () => {
    it("verifies correct data mapping to header indices", () => {
      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(2) // Skip ValueTitle + Empty columns

      // Use constants for consistent mapping
      // Change column now shows gainOnDay sum for mobile visibility
      expect(dataCells[0]).toHaveTextContent("72.76") // HEADER_INDICES.CHANGE - gainOnDay sum

      // Verify data using constants (accounting for new data array structure)
      // New order: Change, GainOnDay, Quantity, Cost, MarketValue, Weight, Dividends, UnrealisedGain, RealisedGain, IRR, Alpha, TotalGain
      expect(dataCells[1]).toHaveTextContent("72.76") // HEADER_INDICES.GAIN_ON_DAY - gainOnDay value
      expect(dataCells[2]).toHaveAttribute("colSpan", "1") // HEADER_INDICES.QUANTITY - empty (no total for quantity)
      expect(dataCells[2]).toHaveTextContent("") // empty quantity column
      expect(dataCells[3].textContent).toMatch(/8,?150\.65/) // HEADER_INDICES.COST - costValue
      expect(dataCells[4].textContent).toMatch(/12,?643\.74/) // HEADER_INDICES.MARKET_VALUE - marketValue
      expect(dataCells[5]).toHaveTextContent("100.00%") // HEADER_INDICES.WEIGHT - weight with % (moved between value and income)
      expect(dataCells[6].textContent).toMatch(/299\.02/) // HEADER_INDICES.DIVIDENDS - dividends
      expect(dataCells[7].textContent).toMatch(/3,?503\.85/) // HEADER_INDICES.UNREALISED_GAIN - unrealisedGain
      expect(dataCells[8].textContent).toMatch(/481\.44/) // HEADER_INDICES.REALISED_GAIN - realisedGain
      expect(dataCells[9]).toHaveTextContent("15.00") // HEADER_INDICES.IRR - irr (no %)
      expect(dataCells[10]).toHaveTextContent("") // HEADER_INDICES.ALPHA - empty spacer
      expect(dataCells[11].textContent).toMatch(/4,?284\.31/) // HEADER_INDICES.TOTAL_GAIN - totalGain
    })

    it("ensures totalGain is not in IRR position", () => {
      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(2)

      // IRR should contain irr value (15.00) and NOT totalGain value
      // IRR is now at position 9 (after realised gain at 8)
      expect(dataCells[9]).toHaveTextContent("15.00") // HEADER_INDICES.IRR
      expect(dataCells[9].textContent).not.toMatch(/4,?284\.31/)

      // totalGain should contain totalGain value in correct position
      expect(dataCells[11].textContent).toMatch(/4,?284\.31/) // HEADER_INDICES.TOTAL_GAIN
    })
  })

  describe("Mobile Layout", () => {
    it("verifies mobile-specific visibility classes", () => {
      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(2)

      // Change column should be visible on all screens (mobile: true)
      expect(dataCells[0]).not.toHaveClass("hidden") // HEADER_INDICES.CHANGE

      // gainOnDay should be hidden on all screens (hidden: true in header)
      expect(dataCells[1]).toHaveClass("hidden") // HEADER_INDICES.GAIN_ON_DAY
      // No responsive suffix - hidden on all screens including desktop
      expect(dataCells[1]).not.toHaveClass("xl:table-cell")

      // marketValue should be visible on mobile
      expect(dataCells[4]).not.toHaveClass("hidden") // HEADER_INDICES.MARKET_VALUE

      // weight should be visible on mobile (mobile: true in header) - now at position 5 (between value and income)
      expect(dataCells[5]).not.toHaveClass("hidden") // HEADER_INDICES.WEIGHT

      // alpha should be hidden on mobile (mobile: false, medium: false in header) - now at position 10
      expect(dataCells[10]).toHaveClass("hidden", "xl:table-cell") // HEADER_INDICES.ALPHA

      // totalGain should be hidden on mobile portrait, visible on landscape+ (mobile: false in header)
      expect(dataCells[11]).toHaveClass("hidden") // HEADER_INDICES.TOTAL_GAIN
      expect(dataCells[11]).toHaveClass("sm:table-cell")
    })
  })

  describe("Constants Verification", () => {
    it("verifies HEADER_INDICES constants are correctly defined", () => {
      // These constants are critical for correct mapping
      // New order: Price(0), Change(1), GainOnDay(2), Quantity(3), Cost(4), MarketValue(5), Weight(6), Dividends(7), Unrealised(8), Realised(9), IRR(10), Alpha(11), TotalGain(12)
      expect(HEADER_INDICES.GAIN_ON_DAY).toBe(2)
      expect(HEADER_INDICES.COST).toBe(4)
      expect(HEADER_INDICES.MARKET_VALUE).toBe(5)
      expect(HEADER_INDICES.WEIGHT).toBe(6) // moved between value and income
      expect(HEADER_INDICES.DIVIDENDS).toBe(7)
      expect(HEADER_INDICES.IRR).toBe(10)
      expect(HEADER_INDICES.ALPHA).toBe(11)
      expect(HEADER_INDICES.TOTAL_GAIN).toBe(12)
    })

    it("verifies data array structure matches expected positions", () => {
      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")

      // Should have ValueTitle(1) + Spacer(1) + Data(12) = 14 total cells
      expect(cells).toHaveLength(14)

      // First cell should be ValueTitle
      expect(cells![0]).toHaveTextContent("Value in PORTFOLIO")

      // Second cell should be empty spacer with colSpan=1 (skips Price column)
      expect(cells![1]).toHaveAttribute("colSpan", "1")
      expect(cells![1]).toHaveTextContent("")

      // Third cell should be Change column (shows gainOnDay sum)
      expect(cells![2]).toHaveAttribute("colSpan", "1")
      expect(cells![2]).toHaveTextContent("72.76")
    })
  })

  describe("Multiplier Application", () => {
    it("verifies percentage multipliers are applied correctly", () => {
      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(2)

      // Weight should be multiplied by 100 and show % - now at position 5 (between value and income)
      expect(dataCells[5]).toHaveTextContent("100.00%") // HEADER_INDICES.WEIGHT

      // IRR should be multiplied by 100 but NOT show % (cleaner appearance) - now at position 9
      expect(dataCells[9]).toHaveTextContent("15.00") // HEADER_INDICES.IRR - 0.15 * 100 = 15.00
      expect(dataCells[9]).not.toHaveTextContent("%")
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

      // Should render empty tbody when no viewTotals
      const tbody = container.querySelector("tbody")
      expect(tbody).toBeInTheDocument()
      expect(tbody?.children.length).toBe(0)
    })

    it("handles null gainOnDay with fallback to 0", () => {
      const holdingsWithNullGain = {
        ...mockHoldings,
        viewTotals: {
          ...mockHoldings.viewTotals!,
          gainOnDay: null as any,
        },
      }

      const { container } = renderGrandTotal({ holdings: holdingsWithNullGain })

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const gainOnDayCell = cells?.[2] // First data cell

      expect(gainOnDayCell).toHaveTextContent("0.00") // null becomes 0, FormatValue correctly shows 0 values
    })
  })
})
