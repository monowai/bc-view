import { headers } from "../Header"

describe("Holdings Table Headers (TDD - Mobile Layout)", () => {
  describe("Price Column Visibility", () => {
    it("should hide Price column on mobile to prevent horizontal scrolling", () => {
      // Find the Price column (key: "asset.price")
      const priceColumn = headers.find((h) => h.key === "asset.price")

      expect(priceColumn).toBeDefined()
      // Price column should NOT be visible on mobile
      expect(priceColumn?.mobile).toBe(false)
    })

    it("should show Price column on medium and larger screens", () => {
      const priceColumn = headers.find((h) => h.key === "asset.price")

      expect(priceColumn).toBeDefined()
      // Price column should be visible on medium+ screens
      expect(priceColumn?.medium).toBe(true)
    })
  })

  describe("Essential Columns on Mobile", () => {
    it("should show Market Value on mobile", () => {
      const marketValueColumn = headers.find((h) => h.key === "summary.value")

      expect(marketValueColumn).toBeDefined()
      expect(marketValueColumn?.mobile).toBe(true)
    })

    it("should show Total Gain on mobile", () => {
      const gainColumn = headers.find((h) => h.key === "gain")

      expect(gainColumn).toBeDefined()
      expect(gainColumn?.mobile).toBe(true)
    })

    it("should show Quantity on mobile", () => {
      const quantityColumn = headers.find((h) => h.key === "quantity")

      expect(quantityColumn).toBeDefined()
      expect(quantityColumn?.mobile).toBe(true)
    })
  })

  describe("Column Count by Breakpoint", () => {
    it("should have fewer columns on mobile than on desktop", () => {
      const mobileColumns = headers.filter((h) => h.mobile)
      const desktopColumns = headers.filter((h) => h.medium)

      expect(mobileColumns.length).toBeLessThan(desktopColumns.length)
    })

    it("should have reasonable number of columns for mobile (max 6)", () => {
      const mobileColumns = headers.filter((h) => h.mobile)

      // Mobile should show 6 columns max to prevent horizontal scrolling
      // After hiding Price column, we have 6 mobile columns
      expect(mobileColumns.length).toBeLessThanOrEqual(6)
    })
  })
})
