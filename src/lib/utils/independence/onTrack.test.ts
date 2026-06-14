import { deriveOnTrackStatus } from "./onTrack"

describe("deriveOnTrackStatus", () => {
  it("is on track when the portfolio never depletes (null age)", () => {
    expect(deriveOnTrackStatus(null, 90, 42)).toEqual({
      onTrack: true,
      lifeExpectancy: 90,
      depletionAge: undefined,
      yearsShort: 0,
    })
  })

  it("is on track when depletion is at or beyond life expectancy", () => {
    expect(deriveOnTrackStatus(90, 90, 42)?.onTrack).toBe(true)
    expect(deriveOnTrackStatus(95, 90, 42)?.onTrack).toBe(true)
  })

  it("is off track when the portfolio depletes before life expectancy", () => {
    const status = deriveOnTrackStatus(78, 83, 45)
    expect(status).toEqual({
      onTrack: false,
      lifeExpectancy: 83,
      depletionAge: 78,
      yearsShort: 5,
    })
  })

  it("returns null when life expectancy is unknown", () => {
    expect(deriveOnTrackStatus(78, undefined, 42)).toBeNull()
    expect(deriveOnTrackStatus(78, 0, 42)).toBeNull()
  })

  it("returns null when current age is unknown (no accumulation runway)", () => {
    // Missing date of birth → projection can't model working years, so a
    // depletion at the default retirement age is an artefact, not a verdict.
    expect(deriveOnTrackStatus(65, 90, undefined)).toBeNull()
  })
})
