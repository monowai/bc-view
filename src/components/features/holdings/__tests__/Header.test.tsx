import { headers } from "../Header"

describe("Holdings Table Headers (TDD - Mobile Layout)", () => {
  describe("Price Column Visibility", () => {
    it("should hide Price column on mobile portrait to prevent horizontal scrolling", () => {
      // Find the Price column (key: "asset.price")
      const priceColumn = headers.find((h) => h.key === "asset.price")

      expect(priceColumn).toBeDefined()
      // Price column should NOT be visible on mobile portrait
      expect(priceColumn?.mobile).toBe(false)
    })

    it("should show Price column on mobile landscape and larger screens (sm:640px+)", () => {
      const priceColumn = headers.find((h) => h.key === "asset.price")

      expect(priceColumn).toBeDefined()
      // Price column should be visible on mobile landscape+ (when medium: true, renders as sm:table-cell)
      expect(priceColumn?.medium).toBe(true)
    })
  })

  describe("Quantity Column Visibility", () => {
    it("should hide Quantity column on mobile portrait to prevent horizontal scrolling", () => {
      // Find the Quantity column (key: "quantity")
      const quantityColumn = headers.find((h) => h.key === "quantity")

      expect(quantityColumn).toBeDefined()
      // Quantity column should NOT be visible on mobile portrait
      expect(quantityColumn?.mobile).toBe(false)
    })

    it("should show Quantity column on mobile landscape and larger screens (sm:640px+)", () => {
      const quantityColumn = headers.find((h) => h.key === "quantity")

      expect(quantityColumn).toBeDefined()
      // Quantity column should be visible on mobile landscape+ (when medium: true, renders as sm:table-cell)
      expect(quantityColumn?.medium).toBe(true)
    })
  })

  describe("Essential Columns on Mobile", () => {
    it("should show Market Value on mobile", () => {
      const marketValueColumn = headers.find((h) => h.key === "summary.value")

      expect(marketValueColumn).toBeDefined()
      expect(marketValueColumn?.mobile).toBe(true)
    })

    it("should hide Total Gain on mobile portrait to save space", () => {
      const gainColumn = headers.find((h) => h.key === "gain")

      expect(gainColumn).toBeDefined()
      expect(gainColumn?.mobile).toBe(false)
    })

    it("should show Change % on mobile", () => {
      const changeColumn = headers.find((h) => h.key === "asset.change")

      expect(changeColumn).toBeDefined()
      expect(changeColumn?.mobile).toBe(true)
    })
  })

  describe("Column Count by Breakpoint", () => {
    it("should have fewer columns on mobile than on desktop", () => {
      const mobileColumns = headers.filter((h) => h.mobile)
      const desktopColumns = headers.filter((h) => h.medium)

      expect(mobileColumns.length).toBeLessThan(desktopColumns.length)
    })

    it("should have reasonable number of columns for mobile portrait (max 5)", () => {
      const mobileColumns = headers.filter((h) => h.mobile)

      // Mobile portrait should show 5 columns max to prevent horizontal scrolling
      // After hiding Price and Quantity columns on portrait, we have 5 mobile columns
      expect(mobileColumns.length).toBeLessThanOrEqual(5)
    })
  })
})
