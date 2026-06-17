import { ValueBasis } from "types/independence"
import { isStreamInflationIndexed } from "./valueBasis"

describe("isStreamInflationIndexed", () => {
  const valueBasis: ValueBasis = {
    balanceBasis: "NOMINAL_FUTURE",
    incomeStreams: [
      { key: "pension", inflationIndexed: false },
      { key: "socialSecurity", inflationIndexed: true },
      { key: "rentalIncome", inflationIndexed: true },
    ],
  }

  it("returns the backend flag for a known stream (pension is fixed)", () => {
    expect(isStreamInflationIndexed(valueBasis, "pension")).toBe(false)
  })

  it("returns the backend flag for an indexed stream (social security)", () => {
    expect(isStreamInflationIndexed(valueBasis, "socialSecurity")).toBe(true)
  })

  it("prefers the backend flag over the fallback map when present", () => {
    // Fallback map defaults pension to false; assert it actually reads the
    // supplied basis rather than the fallback by flipping the supplied flag.
    const flipped: ValueBasis = {
      balanceBasis: "NOMINAL_FUTURE",
      incomeStreams: [{ key: "pension", inflationIndexed: true }],
    }
    expect(isStreamInflationIndexed(flipped, "pension")).toBe(true)
  })

  it("falls back to known defaults when valueBasis is undefined", () => {
    expect(isStreamInflationIndexed(undefined, "pension")).toBe(false)
    expect(isStreamInflationIndexed(undefined, "socialSecurity")).toBe(true)
    expect(isStreamInflationIndexed(undefined, "rentalIncome")).toBe(true)
    expect(isStreamInflationIndexed(undefined, "investmentReturns")).toBe(false)
  })

  it("returns undefined for an unknown stream with no fallback", () => {
    expect(
      isStreamInflationIndexed(valueBasis, "mysteryStream"),
    ).toBeUndefined()
    expect(isStreamInflationIndexed(undefined, "mysteryStream")).toBeUndefined()
  })
})
