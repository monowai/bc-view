import {
  mapToReportCategory,
  getReportCategory,
  REPORT_CATEGORIES,
  compareByReportCategory,
} from "./categoryMapping"
import { Asset } from "types/beancounter"

describe("categoryMapping", () => {
  describe("mapToReportCategory", () => {
    it("maps CASH to Cash", () => {
      expect(mapToReportCategory("CASH")).toBe(REPORT_CATEGORIES.CASH)
    })

    it("maps ACCOUNT to Cash", () => {
      expect(mapToReportCategory("ACCOUNT")).toBe(REPORT_CATEGORIES.CASH)
    })

    it("maps TRADE to Cash", () => {
      expect(mapToReportCategory("TRADE")).toBe(REPORT_CATEGORIES.CASH)
    })

    it("maps Bank Account to Cash (case insensitive)", () => {
      expect(mapToReportCategory("Bank Account")).toBe(REPORT_CATEGORIES.CASH)
    })

    it("maps RE to Property", () => {
      expect(mapToReportCategory("RE")).toBe(REPORT_CATEGORIES.PROPERTY)
    })

    it("maps Exchange Traded Fund to ETF", () => {
      expect(mapToReportCategory("Exchange Traded Fund")).toBe(
        REPORT_CATEGORIES.ETF,
      )
    })

    it("maps ETF to ETF", () => {
      expect(mapToReportCategory("ETF")).toBe(REPORT_CATEGORIES.ETF)
    })

    it("maps EQUITY to Equity", () => {
      expect(mapToReportCategory("EQUITY")).toBe(REPORT_CATEGORIES.EQUITY)
    })

    it("maps Equity (mixed case) to Equity", () => {
      expect(mapToReportCategory("Equity")).toBe(REPORT_CATEGORIES.EQUITY)
    })

    it("maps MUTUAL FUND to Mutual Fund", () => {
      expect(mapToReportCategory("MUTUAL FUND")).toBe(
        REPORT_CATEGORIES.MUTUAL_FUND,
      )
    })

    it("returns original category for unknown categories", () => {
      expect(mapToReportCategory("SomeNewCategory")).toBe("SomeNewCategory")
    })
  })

  describe("getReportCategory", () => {
    const createAsset = (overrides: Partial<Asset> = {}): Asset => ({
      id: "test",
      code: "TEST",
      name: "Test Asset",
      assetCategory: { id: "Equity", name: "Equity" },
      market: {
        code: "NASDAQ",
        name: "NASDAQ",
        currency: { code: "USD", name: "US Dollar", symbol: "$" },
      },
      ...overrides,
    })

    it("uses effectiveReportCategory when available", () => {
      const asset = createAsset({
        effectiveReportCategory: "Custom Category",
        assetCategory: { id: "ACCOUNT", name: "Account" },
      })

      expect(getReportCategory(asset)).toBe("Custom Category")
    })

    it("falls back to mapping when effectiveReportCategory is not set", () => {
      const asset = createAsset({
        assetCategory: { id: "ACCOUNT", name: "Account" },
      })

      expect(getReportCategory(asset)).toBe(REPORT_CATEGORIES.CASH)
    })

    it("uses Equity as default when assetCategory is missing", () => {
      const asset = createAsset({
        assetCategory: undefined as any,
      })

      expect(getReportCategory(asset)).toBe("Equity")
    })
  })

  describe("compareByReportCategory", () => {
    it("sorts Equity before ETF", () => {
      expect(compareByReportCategory("Equity", "ETF")).toBeLessThan(0)
    })

    it("sorts ETF before Mutual Fund", () => {
      expect(compareByReportCategory("ETF", "Mutual Fund")).toBeLessThan(0)
    })

    it("sorts Mutual Fund before Cash", () => {
      expect(compareByReportCategory("Mutual Fund", "Cash")).toBeLessThan(0)
    })

    it("sorts Cash before Property", () => {
      expect(compareByReportCategory("Cash", "Property")).toBeLessThan(0)
    })

    it("sorts unknown categories after known ones", () => {
      expect(compareByReportCategory("Property", "Unknown")).toBeLessThan(0)
    })

    it("returns 0 for same category", () => {
      expect(compareByReportCategory("Equity", "Equity")).toBe(0)
    })
  })
})
