import "./testSetup"
import { GRANDTOTAL_LAYOUT, RESPONSIVE_BREAKPOINTS } from "../constants"
import { renderGrandTotal } from "./testHelpers"

describe("GrandTotal Snapshot Tests", () => {
  afterEach(() => {
    // Reset viewport after each test
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  it("matches desktop snapshot", () => {
    // Mock desktop viewport (1200px+)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.DESKTOP_WIDTH,
    })

    const { container } = renderGrandTotal()

    expect(container.firstChild).toMatchSnapshot("desktop-layout")
  })

  it("matches tablet snapshot", () => {
    // Mock tablet viewport (768px - 1199px)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.TABLET_WIDTH,
    })

    const { container } = renderGrandTotal()

    expect(container.firstChild).toMatchSnapshot("tablet-layout")
  })

  it("matches mobile snapshot", () => {
    // Mock mobile viewport (< 768px)
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: RESPONSIVE_BREAKPOINTS.MOBILE_WIDTH,
    })

    const { container } = renderGrandTotal()

    expect(container.firstChild).toMatchSnapshot("mobile-layout")
  })

  describe("Regression Protection", () => {
    it("preserves desktop column structure (all 13 columns present)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1400,
      })

      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")

      // Should have all cells: label + spacer + data cells
      expect(cells).toHaveLength(GRANDTOTAL_LAYOUT.TOTAL_CELLS)

      // All data cells should be visible on desktop
      const dataCells = Array.from(cells!).slice(
        GRANDTOTAL_LAYOUT.DATA_CELLS_SLICE_START,
      )

      // On desktop, most columns should be visible - except gainOnDay which is now hidden on all screens
      // Mobile portrait-only hidden: 'hidden sm:table-cell' or 'hidden xl:table-cell' (visible on desktop)
      // Always hidden: 'hidden' with no suffix (gainOnDay column)
      const hiddenOnDesktop = dataCells.filter((cell) => {
        const classes = cell.className
        // Hidden on desktop if it has 'hidden' but no responsive suffix that makes it visible on desktop
        return (
          classes.includes("hidden") &&
          !classes.includes("sm:table-cell") &&
          !classes.includes("md:table-cell") &&
          !classes.includes("xl:table-cell")
        )
      })

      // Should have 1 column hidden on desktop (gainOnDay is hidden on all screens)
      expect(hiddenOnDesktop).toHaveLength(1)

      // Verify we have all data cells
      expect(dataCells).toHaveLength(GRANDTOTAL_LAYOUT.DATA_CELL_COUNT)
    })

    it("preserves tablet column structure (9 visible columns)", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 768,
      })

      const { container } = renderGrandTotal()

      const dataRow = container.querySelector("tbody tr:last-child")
      const cells = dataRow?.querySelectorAll("td")
      const dataCells = Array.from(cells!).slice(2)

      // Count visible columns on tablet (768px)
      // At this breakpoint, sm:table-cell (640px+) and md:table-cell are visible, but xl:table-cell is not
      const visibleColumns = dataCells.filter((cell) => {
        const classes = cell.className
        return (
          !classes.includes("hidden") ||
          classes.includes("sm:table-cell") ||
          classes.includes("md:table-cell")
        )
      })

      // Should have 8 visible columns on tablet (gainOnDay now hidden, only visible on xl desktop)
      // Change, Quantity, Cost, MarketValue, Dividends, IRR, Weight, TotalGain
      expect(visibleColumns).toHaveLength(8)

      // Verify key columns are in correct positions
      expect(dataCells[0]).toHaveTextContent("72.76") // Change (shows gainOnDay sum)
      expect(dataCells[1]).toHaveTextContent("72.76") // gainOnDay
      expect(dataCells[4]).toHaveTextContent(/12,?643\.74/) // marketValue
      expect(dataCells[11]).toHaveTextContent(/4,?284\.31/) // totalGain
    })
  })
})
