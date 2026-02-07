import { getCellClasses, getSubTotalCellClasses } from "../cellClasses"

describe("getCellClasses", () => {
  it("includes tabular-nums for numeric columns", () => {
    // price (0), quantity (3), cost (4), market value (5), dividends (7),
    // unrealised gain (8), realised gain (9), total gain (12)
    for (const index of [0, 3, 4, 5, 7, 8, 9, 12]) {
      expect(getCellClasses(index)).toContain("tabular-nums")
    }
  })

  it("does not include tabular-nums for non-numeric columns", () => {
    // change% (1), gain on day (2), IRR (6), weight (10), alpha (11)
    for (const index of [1, 2, 6, 10, 11]) {
      expect(getCellClasses(index)).not.toContain("tabular-nums")
    }
  })

  it("does not include font-mono", () => {
    for (let i = 0; i <= 12; i++) {
      expect(getCellClasses(i)).not.toContain("font-mono")
    }
  })

  it("includes text-right alignment", () => {
    expect(getCellClasses(0)).toContain("text-right")
  })

  it("hides gain-on-day column on all screens", () => {
    const classes = getCellClasses(2)
    // hidden: true in header definition — should just be "hidden"
    expect(classes).toMatch(/\bhidden\b/)
    expect(classes).not.toContain("sm:table-cell")
    expect(classes).not.toContain("xl:table-cell")
  })

  it("shows mobile columns on all screens", () => {
    // change% (1) is mobile: true
    const classes = getCellClasses(1)
    expect(classes).not.toMatch(/\bhidden\b/)
  })

  it("shows medium columns from sm breakpoint", () => {
    // price (0) is medium: true, mobile: false
    const classes = getCellClasses(0)
    expect(classes).toContain("hidden sm:table-cell")
  })

  it("shows desktop-only columns from xl breakpoint", () => {
    // unrealised gain (8) is mobile: false, medium: false
    const classes = getCellClasses(8)
    expect(classes).toContain("hidden xl:table-cell")
  })
})

describe("getSubTotalCellClasses", () => {
  it("includes tabular-nums for subtotal numeric columns", () => {
    for (const index of [0, 4, 5, 7, 8, 9, 12]) {
      expect(getSubTotalCellClasses(index)).toContain("tabular-nums")
    }
  })

  it("does not include tabular-nums for non-numeric subtotal columns", () => {
    // quantity (3), IRR (6), weight (10), alpha (11)
    for (const index of [1, 2, 3, 6, 10, 11]) {
      expect(getSubTotalCellClasses(index)).not.toContain("tabular-nums")
    }
  })

  it("respects center alignment for alpha column", () => {
    const classes = getSubTotalCellClasses(11) // alpha has align: "center"
    expect(classes).toContain("text-center")
  })

  it("uses text-right for right-aligned columns", () => {
    const classes = getSubTotalCellClasses(4) // cost has align: "right"
    expect(classes).toContain("text-right")
  })
})
