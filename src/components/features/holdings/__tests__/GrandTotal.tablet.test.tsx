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

  it("verifies tablet shows Change column (FIXED)", () => {
    const { container } = renderGrandTotal()

    const dataRow = container.querySelector("tbody tr:last-child")
    const cells = dataRow?.querySelectorAll("td")
    const dataCells = Array.from(cells!).slice(2)

    // FIXED: Change column is now present as first data cell
    const changeCell = dataCells[0] // First data cell is Change column
    expect(changeCell).toHaveTextContent("") // Shows empty placeholder for Change

    // Change should be visible on tablet (no hidden classes)
    expect(changeCell).not.toHaveClass("hidden")

    // gainOnDay should now be second data cell
    const gainOnDayCell = dataCells[1]
    expect(gainOnDayCell).toHaveTextContent("72.76") // Shows gainOnDay value
  })

  it("verifies totalGain alignment on tablet (FIXED)", () => {
    const { container } = renderGrandTotal()

    const dataRow = container.querySelector("tbody tr:last-child")
    const cells = dataRow?.querySelectorAll("td")
    const dataCells = Array.from(cells!).slice(2)

    // Count visible columns on tablet (excluding hidden columns)
    const visibleColumns = dataCells.filter((cell) => {
      const classes = cell.className
      return !classes.includes("hidden") || classes.includes("md:table-cell")
    })

    // FIXED: Should now have 10 visible columns (including Change)
    expect(visibleColumns.length).toBe(10)

    // totalGain should be in the LAST visible position (10th position, index 9)
    const lastVisibleCell = visibleColumns[9]
    expect(lastVisibleCell.textContent).toMatch(/4,?284\.31/)

    // FIXED: Change column should be first visible column
    const firstVisibleCell = visibleColumns[0]
    expect(firstVisibleCell.textContent).toBe("") // Change placeholder
  })
})
