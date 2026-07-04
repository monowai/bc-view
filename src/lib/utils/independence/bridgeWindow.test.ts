import { deriveBridgeWindow } from "./bridgeWindow"

describe("deriveBridgeWindow", () => {
  it("shows the window when income starts after the independence age", () => {
    // NZD Live In: retire 60, Social Security at 67 -> 7-year self-funded gap.
    const w = deriveBridgeWindow({ bridgeToAge: 67, retirementAge: 60 })
    expect(w.show).toBe(true)
    expect(w.fromAge).toBe(60)
    expect(w.toAge).toBe(67)
  })

  it("hides the window when income starts at the independence age (no gap)", () => {
    const w = deriveBridgeWindow({ bridgeToAge: 60, retirementAge: 60 })
    expect(w.show).toBe(false)
    expect(w.fromAge).toBeNull()
    expect(w.toAge).toBeNull()
  })

  it("hides the window when income starts before the independence age", () => {
    const w = deriveBridgeWindow({ bridgeToAge: 55, retirementAge: 60 })
    expect(w.show).toBe(false)
  })

  it("hides the window when bridgeToAge is missing", () => {
    expect(deriveBridgeWindow({ retirementAge: 60 }).show).toBe(false)
    expect(
      deriveBridgeWindow({ bridgeToAge: null, retirementAge: 60 }).show,
    ).toBe(false)
  })

  it("hides the window when the retirement age is unknown", () => {
    expect(deriveBridgeWindow({ bridgeToAge: 67 }).show).toBe(false)
    expect(
      deriveBridgeWindow({ bridgeToAge: 67, retirementAge: null }).show,
    ).toBe(false)
  })
})
