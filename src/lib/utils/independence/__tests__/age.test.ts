import { currentAgeFromSettings, resolveDisplayAges } from "../age"

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
