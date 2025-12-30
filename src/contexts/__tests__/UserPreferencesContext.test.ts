import { toViewMode, toValueIn, toGroupBy } from "../UserPreferencesContext"
import { GROUP_BY_OPTIONS, VALUE_IN_OPTIONS } from "types/constants"

describe("UserPreferencesContext helper functions", () => {
  describe("toViewMode", () => {
    it("converts TABLE to table", () => {
      expect(toViewMode("TABLE")).toBe("table")
    })

    it("converts HEATMAP to heatmap", () => {
      expect(toViewMode("HEATMAP")).toBe("heatmap")
    })

    it("converts ALLOCATION to summary (consolidated view)", () => {
      expect(toViewMode("ALLOCATION")).toBe("summary")
    })

    it("converts SUMMARY to summary", () => {
      expect(toViewMode("SUMMARY")).toBe("summary")
    })

    it("defaults to summary for undefined", () => {
      expect(toViewMode(undefined)).toBe("summary")
    })
  })

  describe("toValueIn", () => {
    it("converts PORTFOLIO to PORTFOLIO", () => {
      expect(toValueIn("PORTFOLIO")).toBe(VALUE_IN_OPTIONS.PORTFOLIO)
    })

    it("converts BASE to BASE", () => {
      expect(toValueIn("BASE")).toBe(VALUE_IN_OPTIONS.BASE)
    })

    it("converts TRADE to TRADE", () => {
      expect(toValueIn("TRADE")).toBe(VALUE_IN_OPTIONS.TRADE)
    })

    it("defaults to PORTFOLIO for undefined", () => {
      expect(toValueIn(undefined)).toBe(VALUE_IN_OPTIONS.PORTFOLIO)
    })
  })

  describe("toGroupBy", () => {
    it("converts ASSET_CLASS API value to property path", () => {
      expect(toGroupBy("ASSET_CLASS")).toBe(GROUP_BY_OPTIONS.ASSET_CLASS)
      expect(toGroupBy("ASSET_CLASS")).toBe("asset.assetCategory.name")
    })

    it("converts SECTOR API value to property path", () => {
      expect(toGroupBy("SECTOR")).toBe(GROUP_BY_OPTIONS.SECTOR)
      expect(toGroupBy("SECTOR")).toBe("asset.sector")
    })

    it("converts MARKET_CURRENCY API value to property path", () => {
      expect(toGroupBy("MARKET_CURRENCY")).toBe(
        GROUP_BY_OPTIONS.MARKET_CURRENCY,
      )
      expect(toGroupBy("MARKET_CURRENCY")).toBe("asset.market.currency.code")
    })

    it("converts MARKET API value to property path", () => {
      expect(toGroupBy("MARKET")).toBe(GROUP_BY_OPTIONS.MARKET)
      expect(toGroupBy("MARKET")).toBe("asset.market.code")
    })

    it("defaults to ASSET_CLASS property path for undefined", () => {
      expect(toGroupBy(undefined)).toBe(GROUP_BY_OPTIONS.ASSET_CLASS)
      expect(toGroupBy(undefined)).toBe("asset.assetCategory.name")
    })
  })
})
