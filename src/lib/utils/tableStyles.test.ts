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
} from "./tableStyles"

describe("tableStyles", () => {
  describe("table structure", () => {
    it("tableContainer includes overflow-x-auto", () => {
      expect(tableContainer).toContain("overflow-x-auto")
    })

    it("tableBase includes min-w-full and divide", () => {
      expect(tableBase).toContain("min-w-full")
      expect(tableBase).toContain("divide-y")
      expect(tableBase).toContain("divide-gray-200")
    })
  })

  describe("header styles", () => {
    it("theadBase has gray background", () => {
      expect(theadBase).toContain("bg-gray-50")
    })

    it("thBase has left-aligned uppercase styling", () => {
      expect(thBase).toContain("text-left")
      expect(thBase).toContain("text-xs")
      expect(thBase).toContain("font-medium")
      expect(thBase).toContain("uppercase")
    })

    it("thRight has right-aligned styling", () => {
      expect(thRight).toContain("text-right")
      expect(thRight).toContain("uppercase")
    })

    it("thCenter has center-aligned styling", () => {
      expect(thCenter).toContain("text-center")
      expect(thCenter).toContain("uppercase")
    })

    it("thCompact has smaller padding", () => {
      expect(thCompact).toContain("px-2")
      expect(thCompact).toContain("py-2")
      expect(thCompact).toContain("uppercase")
    })
  })

  describe("body styles", () => {
    it("tbodyBase includes divide styles", () => {
      expect(tbodyBase).toContain("divide-y")
      expect(tbodyBase).toContain("divide-gray-200")
    })

    it("trHover includes hover effect", () => {
      expect(trHover).toContain("hover:bg-slate-50")
      expect(trHover).toContain("transition-colors")
    })

    it("trClickable includes hover and cursor", () => {
      expect(trClickable).toContain("hover:bg-slate-50")
      expect(trClickable).toContain("cursor-pointer")
    })
  })

  describe("cell styles", () => {
    it("tdBase has standard padding and text", () => {
      expect(tdBase).toContain("px-4")
      expect(tdBase).toContain("py-3")
      expect(tdBase).toContain("text-sm")
    })

    it("tdRight has right alignment and tabular-nums", () => {
      expect(tdRight).toContain("text-right")
      expect(tdRight).toContain("tabular-nums")
    })

    it("tdCompact has smaller padding", () => {
      expect(tdCompact).toContain("px-2")
      expect(tdCompact).toContain("py-2")
    })

    it("tdCompactRight has smaller padding and right alignment", () => {
      expect(tdCompactRight).toContain("px-2")
      expect(tdCompactRight).toContain("text-right")
      expect(tdCompactRight).toContain("tabular-nums")
    })
  })

  describe("responsive visibility", () => {
    it("hiddenSm shows at sm breakpoint", () => {
      expect(hiddenSm).toContain("hidden")
      expect(hiddenSm).toContain("sm:table-cell")
    })

    it("hiddenMd shows at md breakpoint", () => {
      expect(hiddenMd).toContain("hidden")
      expect(hiddenMd).toContain("md:table-cell")
    })

    it("hiddenLg shows at lg breakpoint", () => {
      expect(hiddenLg).toContain("hidden")
      expect(hiddenLg).toContain("lg:table-cell")
    })

    it("hiddenXl shows at xl breakpoint", () => {
      expect(hiddenXl).toContain("hidden")
      expect(hiddenXl).toContain("xl:table-cell")
    })
  })
})
