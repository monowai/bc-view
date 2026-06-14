import { ageAxisDomain, ageAxisTicks } from "./ageAxis"

describe("ageAxisDomain", () => {
  it("spans currentAge → lifeExpectancy regardless of data range", () => {
    // Data depletes at 80, but axis must still reach life expectancy 90.
    expect(ageAxisDomain(45, 90, [45, 60, 80])).toEqual([45, 90])
  })

  it("extends to lifeExpectancy even if data runs past it", () => {
    expect(ageAxisDomain(45, 90, [45, 95, 100])).toEqual([45, 90])
  })

  it("falls back to data range when age inputs are missing", () => {
    expect(ageAxisDomain(undefined, undefined, [50, 70])).toEqual([50, 70])
  })

  it("guards a degenerate range", () => {
    const [min, max] = ageAxisDomain(90, 90, [90])
    expect(max).toBeGreaterThan(min)
  })
})

describe("ageAxisTicks", () => {
  it("pins both endpoints", () => {
    const ticks = ageAxisTicks(45, 90)
    expect(ticks[0]).toBe(45)
    expect(ticks[ticks.length - 1]).toBe(90)
  })

  it("uses 5-year steps for a <=30y span", () => {
    expect(ageAxisTicks(45, 60)).toEqual([45, 50, 55, 60])
  })

  it("folds in extra ages inside the range, de-duped and sorted", () => {
    const ticks = ageAxisTicks(45, 90, [60, 67])
    expect(ticks).toContain(60)
    expect(ticks).toContain(67)
    expect([...ticks]).toEqual([...ticks].sort((a, b) => a - b))
    expect(new Set(ticks).size).toBe(ticks.length)
  })

  it("ignores extras outside the range", () => {
    expect(ageAxisTicks(45, 60, [90])).not.toContain(90)
  })
})
