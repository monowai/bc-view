import { HoldingContract } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import { transformToAllocationSlices } from "./aggregateHoldings"
import testHoldings from "../holdings/__fixtures__/test-holdings.json"

describe("transformToAllocationSlices", () => {
  const holdingContract = testHoldings.data as unknown as HoldingContract

  describe("grouping by category", () => {
    it("should aggregate positions by report category", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      // Should have 3 report categories: Equity, ETF, Cash
      expect(result.length).toBe(3)

      const categories = result.map((s) => s.key)
      expect(categories).toContain("Equity")
      expect(categories).toContain("ETF") // Mapped from "Exchange Traded Fund"
      expect(categories).toContain("Cash")
    })

    it("should sum market values correctly per category", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      // Equity: BKNG (3780.03) + MCD (1071.8) = 4851.83
      const equity = result.find((s) => s.key === "Equity")
      expect(equity?.value).toBeCloseTo(4851.83, 2)

      // ETF: QQQ (441.02) + SMH (0) = 441.02
      const etf = result.find((s) => s.key === "ETF")
      expect(etf?.value).toBeCloseTo(441.02, 2)

      // Cash: USD (5741.0)
      const cash = result.find((s) => s.key === "Cash")
      expect(cash?.value).toBeCloseTo(5741.0, 2)
    })

    it("should calculate percentages correctly", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      // Total: 11033.85
      const total = result.reduce((sum, s) => sum + s.value, 0)
      expect(total).toBeCloseTo(11033.85, 2)

      // Percentages should sum to 100
      const percentSum = result.reduce((sum, s) => sum + s.percentage, 0)
      expect(percentSum).toBeCloseTo(100, 1)

      // Cash: 5741 / 11033.85 = 52.03%
      const cash = result.find((s) => s.key === "Cash")
      expect(cash?.percentage).toBeCloseTo(52.03, 1)
    })
  })

  describe("grouping by asset", () => {
    it("should aggregate positions by individual asset", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "asset",
        ValueIn.PORTFOLIO,
      )

      // Should have 5 assets (including zero-value SMH)
      expect(result.length).toBe(5)

      const assets = result.map((s) => s.key)
      expect(assets).toContain("BKNG")
      expect(assets).toContain("MCD")
      expect(assets).toContain("QQQ")
      expect(assets).toContain("SMH")
      expect(assets).toContain("USD")
    })

    it("should use asset name as label", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "asset",
        ValueIn.PORTFOLIO,
      )

      const bkng = result.find((s) => s.key === "BKNG")
      expect(bkng?.label).toBe("Booking Holdings Inc")

      const mcd = result.find((s) => s.key === "MCD")
      expect(mcd?.label).toBe("McDonald`s Corp")
    })

    it("should preserve individual market values", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "asset",
        ValueIn.PORTFOLIO,
      )

      const bkng = result.find((s) => s.key === "BKNG")
      expect(bkng?.value).toBeCloseTo(3780.03, 2)

      const smh = result.find((s) => s.key === "SMH")
      expect(smh?.value).toBe(0)
    })
  })

  describe("grouping by market", () => {
    it("should aggregate positions by market code", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "market",
        ValueIn.PORTFOLIO,
      )

      // Should have 2 markets: US and CASH
      expect(result.length).toBe(2)

      const markets = result.map((s) => s.key)
      expect(markets).toContain("US")
      expect(markets).toContain("CASH")
    })

    it("should sum market values per market", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "market",
        ValueIn.PORTFOLIO,
      )

      // US market: BKNG + MCD + QQQ + SMH = 5292.85
      const us = result.find((s) => s.key === "US")
      expect(us?.value).toBeCloseTo(5292.85, 2)

      // CASH market: USD = 5741.0
      const cash = result.find((s) => s.key === "CASH")
      expect(cash?.value).toBeCloseTo(5741.0, 2)
    })
  })

  describe("edge cases", () => {
    it("should handle holdings with no positions", () => {
      const emptyHoldings: HoldingContract = {
        ...holdingContract,
        positions: {},
      }

      const result = transformToAllocationSlices(
        emptyHoldings,
        "category",
        ValueIn.PORTFOLIO,
      )

      expect(result).toEqual([])
    })

    it("should use different valueIn currencies", () => {
      const portfolioResult = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )
      const baseResult = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.BASE,
      )

      // In this test data, PORTFOLIO and BASE are both USD so values should be the same
      expect(portfolioResult[0].value).toBe(baseResult[0].value)
    })
  })

  describe("colors", () => {
    it("should assign colors to slices", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      result.forEach((slice) => {
        expect(slice.color).toBeDefined()
        expect(slice.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      })
    })

    it("should use consistent colors for known categories", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      const equity = result.find((s) => s.key === "Equity")
      expect(equity?.color).toBe("#3B82F6") // blue

      const etf = result.find((s) => s.key === "ETF")
      expect(etf?.color).toBe("#10B981") // green

      const cash = result.find((s) => s.key === "Cash")
      expect(cash?.color).toBe("#6B7280") // gray
    })
  })

  describe("sorting", () => {
    it("should sort slices by value descending", () => {
      const result = transformToAllocationSlices(
        holdingContract,
        "category",
        ValueIn.PORTFOLIO,
      )

      // Cash (5741) > Equity (4851.83) > ETF (441.02)
      expect(result[0].key).toBe("Cash")
      expect(result[1].key).toBe("Equity")
      expect(result[2].key).toBe("ETF")
    })
  })
})
