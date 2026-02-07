import { stripOwnerPrefix, getDisplayCode } from "../assetUtils"

describe("stripOwnerPrefix", () => {
  it("returns code after last dot", () => {
    expect(stripOwnerPrefix("userId.WISE")).toBe("WISE")
  })

  it("returns full code when no dot present", () => {
    expect(stripOwnerPrefix("AAPL")).toBe("AAPL")
  })

  it("returns empty string for empty input", () => {
    expect(stripOwnerPrefix("")).toBe("")
  })

  it("handles code with multiple dots (returns after last dot)", () => {
    expect(stripOwnerPrefix("a.b.c")).toBe("c")
  })

  it("handles dot at start", () => {
    expect(stripOwnerPrefix(".WISE")).toBe("WISE")
  })

  it("handles dot at end", () => {
    expect(stripOwnerPrefix("userId.")).toBe("")
  })
})

describe("getDisplayCode", () => {
  it("returns stripped code for asset with owner prefix", () => {
    const asset = { code: "userId.SCB-SGD" } as any
    expect(getDisplayCode(asset)).toBe("SCB-SGD")
  })

  it("returns code as-is for asset without dot", () => {
    const asset = { code: "AAPL" } as any
    expect(getDisplayCode(asset)).toBe("AAPL")
  })

  it("returns empty string for null asset", () => {
    expect(getDisplayCode(null)).toBe("")
  })

  it("returns empty string for undefined asset", () => {
    expect(getDisplayCode(undefined)).toBe("")
  })
})
