import {
  currentAgeFromSettings,
  planRetirementAge,
  resolveDisplayAges,
} from "../age"

describe("currentAgeFromSettings", () => {
  it("returns undefined when yearOfBirth is missing", () => {
    expect(currentAgeFromSettings(undefined)).toBeUndefined()
    expect(currentAgeFromSettings({})).toBeUndefined()
  })

  it("computes age from yearOfBirth alone", () => {
    const thisYear = new Date().getFullYear()
    expect(currentAgeFromSettings({ yearOfBirth: thisYear - 40 })).toBe(40)
  })
})

describe("resolveDisplayAges", () => {
  // bc-view #1144: svc-retire echoes the demographics it actually used
  // (RetirementProjection.planInputs) — the backend is authoritative, so
  // the echo must win over any client-derived value whenever a projection
  // has landed, for every plan (not just shared ones).
  const local = { currentAge: 46, retirementAge: 65, lifeExpectancy: 90 }

  it("prefers the projection echo over the locally-derived values", () => {
    const result = resolveDisplayAges(
      { currentAge: 47, retirementAge: 62, lifeExpectancy: 92 },
      local,
    )
    expect(result).toEqual({
      currentAge: 47,
      retirementAge: 62,
      lifeExpectancy: 92,
    })
  })

  it("falls back to local values field-by-field when the echo is partial", () => {
    const result = resolveDisplayAges({ currentAge: 47 }, local)
    expect(result).toEqual({
      currentAge: 47,
      retirementAge: 65,
      lifeExpectancy: 90,
    })
  })

  it("falls back to local values entirely when no projection has landed yet", () => {
    const result = resolveDisplayAges(undefined, local)
    expect(result).toEqual(local)
  })
})

describe("planRetirementAge", () => {
  it("is the age at retiredOn when the user has retired", () => {
    expect(
      planRetirementAge({
        yearOfBirth: 1960,
        monthOfBirth: 1,
        targetIndependenceAge: 70,
        retiredOn: "2024-03-01",
      }),
    ).toBe(64)
  })

  it("applies the birth-month rule at the retirement date", () => {
    const base = { yearOfBirth: 1960, targetIndependenceAge: 70 }
    // Retired in March: born in March has turned 64, born in April has not.
    expect(
      planRetirementAge({ ...base, monthOfBirth: 3, retiredOn: "2024-03-01" }),
    ).toBe(64)
    expect(
      planRetirementAge({ ...base, monthOfBirth: 4, retiredOn: "2024-03-01" }),
    ).toBe(63)
  })

  it("falls back to the target age when yearOfBirth is missing", () => {
    expect(
      planRetirementAge({ targetIndependenceAge: 62, retiredOn: "2024-03-01" }),
    ).toBe(62)
  })

  it("uses a stored retiredOn without reading the clock, as svc-retire does", () => {
    expect(
      planRetirementAge({
        yearOfBirth: 1960,
        monthOfBirth: 1,
        targetIndependenceAge: 70,
        retiredOn: "2099-01-01",
      }),
    ).toBe(139)
  })

  it("is the target age when the user has not retired", () => {
    expect(
      planRetirementAge({
        yearOfBirth: 1980,
        targetIndependenceAge: 60,
        retiredOn: null,
      }),
    ).toBe(60)
    expect(planRetirementAge(undefined)).toBeUndefined()
  })
})
