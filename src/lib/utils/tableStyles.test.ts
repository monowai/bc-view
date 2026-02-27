import {
  tableContainer,
  tableBase,
  theadBase,
  thBase,
  thRight,
  thCenter,
  thCompact,
  tbodyBase,
  trHover,
  trClickable,
  tdBase,
  tdRight,
  tdCompact,
  tdCompactRight,
  hiddenSm,
  hiddenMd,
  hiddenLg,
  hiddenXl,
} from "@utils/tableStyles"

describe("tableStyles", () => {
  describe("table structure", () => {
    it("tableContainer is overflow-x-auto", () => {
      expect(tableContainer).toBe("overflow-x-auto")
    })

    it("tableBase is min-w-full with dividers", () => {
      expect(tableBase).toBe("min-w-full divide-y divide-gray-200")
    })
  })

  describe("header styles", () => {
    it("theadBase has gray background", () => {
      expect(theadBase).toBe("bg-gray-50")
    })

    it("thBase has left-aligned uppercase styling", () => {
      expect(thBase).toBe(
        "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
      )
    })

    it("thRight has right-aligned uppercase styling", () => {
      expect(thRight).toBe(
        "px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider",
      )
    })

    it("thCenter has center-aligned uppercase styling", () => {
      expect(thCenter).toBe(
        "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider",
      )
    })

    it("thCompact has smaller padding with uppercase styling", () => {
      expect(thCompact).toBe(
        "px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
      )
    })
  })

  describe("body styles", () => {
    it("tbodyBase has dividers", () => {
      expect(tbodyBase).toBe("divide-y divide-gray-200")
    })

    it("trHover has hover effect with transition", () => {
      expect(trHover).toBe("hover:bg-slate-50 transition-colors")
    })

    it("trClickable has hover, transition and cursor", () => {
      expect(trClickable).toBe(
        "hover:bg-slate-50 transition-colors cursor-pointer",
      )
    })
  })

  describe("cell styles", () => {
    it("tdBase has standard padding and text", () => {
      expect(tdBase).toBe("px-4 py-3 text-sm text-gray-700")
    })

    it("tdRight has right alignment with tabular-nums", () => {
      expect(tdRight).toBe("px-4 py-3 text-sm text-right tabular-nums")
    })

    it("tdCompact has smaller padding", () => {
      expect(tdCompact).toBe("px-2 py-2 text-sm text-gray-700")
    })

    it("tdCompactRight has smaller padding with right alignment", () => {
      expect(tdCompactRight).toBe("px-2 py-2 text-sm text-right tabular-nums")
    })
  })

  describe("responsive visibility", () => {
    it("hiddenSm shows at sm breakpoint", () => {
      expect(hiddenSm).toBe("hidden sm:table-cell")
    })

    it("hiddenMd shows at md breakpoint", () => {
      expect(hiddenMd).toBe("hidden md:table-cell")
    })

    it("hiddenLg shows at lg breakpoint", () => {
      expect(hiddenLg).toBe("hidden lg:table-cell")
    })

    it("hiddenXl shows at xl breakpoint", () => {
      expect(hiddenXl).toBe("hidden xl:table-cell")
    })
  })
})
