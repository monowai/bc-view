import { todayIso, toErrorMessage, gainLossClass } from "@lib/formatters"

describe("todayIso", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("toErrorMessage", () => {
  it("returns Error.message for Error instances", () => {
    expect(toErrorMessage(new Error("boom"))).toBe("boom")
  })
  it("returns fallback for non-Error values", () => {
    expect(toErrorMessage("oops")).toBe("Unknown error")
  })
  it("respects a custom fallback", () => {
    expect(toErrorMessage(null, "custom fallback")).toBe("custom fallback")
  })
})

describe("gainLossClass", () => {
  it("returns text-green-600 for positive values", () => {
    expect(gainLossClass(1)).toBe("text-green-600")
  })
  it("returns text-green-600 for zero", () => {
    expect(gainLossClass(0)).toBe("text-green-600")
  })
  it("returns text-red-600 for negative values", () => {
    expect(gainLossClass(-1)).toBe("text-red-600")
  })
})
