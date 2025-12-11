import "./testSetup"
import { renderGrandTotal } from "./testHelpers"

describe("GrandTotal Tablet-Specific Tests (TDD)", () => {
  beforeEach(() => {
    // Mock tablet viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768, // Tablet size (md breakpoint)
    })
  })

  it("verifies tablet shows Change column with gainOnDay sum (FIXED)", () => {
    const { container } = renderGrandTotal()

    const dataRow = container.querySelector("tbody tr:last-child")
    const cells = dataRow?.querySelectorAll("td")
    const dataCells = Array.from(cells!).slice(2)

    // FIXED: Change column now shows gainOnDay sum for mobile visibility
    const changeCell = dataCells[0] // First data cell is Change column
    expect(changeCell).toHaveTextContent("72.76") // Shows gainOnDay sum in Change column

    // Change should be visible on tablet (no hidden classes)
    expect(changeCell).not.toHaveClass("hidden")

    // gainOnDay column is now hidden on all screens including desktop
    const gainOnDayCell = dataCells[1]
    expect(gainOnDayCell).toHaveTextContent("72.76") // Shows gainOnDay value
    expect(gainOnDayCell).toHaveClass("hidden") // Hidden on all screens
    expect(gainOnDayCell).not.toHaveClass("xl:table-cell") // No responsive suffix
  })

  it("verifies totalGain alignment on tablet (FIXED)", () => {
    const { container } = renderGrandTotal()

    const dataRow = container.querySelector("tbody tr:last-child")
    const cells = dataRow?.querySelectorAll("td")
    const dataCells = Array.from(cells!).slice(2)

    // Count visible columns on tablet (768px)
    // At this breakpoint, sm:table-cell (640px+) and md:table-cell are visible
    // Note: gainOnDay column is now hidden on tablet (only visible on xl desktop)
    const visibleColumns = dataCells.filter((cell) => {
      const classes = cell.className
      return (
        !classes.includes("hidden") ||
        classes.includes("sm:table-cell") ||
        classes.includes("md:table-cell")
      )
    })

    // Should have 8 visible columns on tablet (gainOnDay now hidden on tablet)
    // Change, Quantity, Cost, MarketValue, Dividends, IRR, Weight, TotalGain
    expect(visibleColumns.length).toBe(8)

    // totalGain should be in the LAST visible position (8th position, index 7)
    const lastVisibleCell = visibleColumns[7]
    expect(lastVisibleCell.textContent).toMatch(/4,?284\.31/)

    // FIXED: Change column should be first visible column with gainOnDay sum
    const firstVisibleCell = visibleColumns[0]
    expect(firstVisibleCell.textContent).toMatch(/72\.76/) // Change shows gainOnDay sum
  })
})
