import {
  ZEN_PORTFOLIO_THRESHOLD,
  deriveZenMode,
  deriveZenModeFromPreferences,
  showPortfolioPicker,
  solePortfolio,
  solePortfolioId,
} from "../zenMode"
import { UserPreferences } from "types/beancounter"
import { makePortfolio } from "@test-fixtures/beancounter"

const prefs = (zenMode?: boolean): UserPreferences =>
  ({ id: "u1", zenMode }) as UserPreferences

describe("deriveZenMode", () => {
  it("is zen at or below the portfolio threshold", () => {
    expect(deriveZenMode(0)).toBe(true)
    expect(deriveZenMode(ZEN_PORTFOLIO_THRESHOLD)).toBe(true)
  })

  it("is master above the threshold", () => {
    expect(deriveZenMode(ZEN_PORTFOLIO_THRESHOLD + 1)).toBe(false)
    expect(deriveZenMode(5)).toBe(false)
  })

  it("lets an explicit true override a multi-portfolio count", () => {
    expect(deriveZenMode(5, true)).toBe(true)
  })

  it("lets an explicit false override a single-portfolio count", () => {
    expect(deriveZenMode(1, false)).toBe(false)
  })

  it("falls back to derivation when the explicit flag is unset", () => {
    expect(deriveZenMode(1, undefined)).toBe(true)
    expect(deriveZenMode(2, null)).toBe(false)
  })
})

describe("deriveZenModeFromPreferences", () => {
  it("reads the explicit flag off preferences when set", () => {
    expect(deriveZenModeFromPreferences(5, prefs(true))).toBe(true)
    expect(deriveZenModeFromPreferences(1, prefs(false))).toBe(false)
  })

  it("derives from count when preferences omit the flag", () => {
    expect(deriveZenModeFromPreferences(1, prefs(undefined))).toBe(true)
    expect(deriveZenModeFromPreferences(3, prefs(undefined))).toBe(false)
  })

  it("derives from count when preferences are null", () => {
    expect(deriveZenModeFromPreferences(1, null)).toBe(true)
    expect(deriveZenModeFromPreferences(3, null)).toBe(false)
  })
})

describe("solePortfolio / solePortfolioId", () => {
  it("returns the only active portfolio", () => {
    const p = makePortfolio({ id: "pf-1" })
    expect(solePortfolio([p])).toBe(p)
    expect(solePortfolioId([p])).toBe("pf-1")
  })

  it("ignores archived portfolios when finding the sole one", () => {
    const live = makePortfolio({ id: "pf-1" })
    const archived = makePortfolio({ id: "pf-old", active: false })
    expect(solePortfolio([live, archived])).toBe(live)
    expect(solePortfolioId([live, archived])).toBe("pf-1")
  })

  it("is null/empty with zero or multiple active portfolios", () => {
    expect(solePortfolio([])).toBeNull()
    expect(solePortfolioId([])).toBe("")
    const two = [makePortfolio({ id: "a" }), makePortfolio({ id: "b" })]
    expect(solePortfolio(two)).toBeNull()
    expect(solePortfolioId(two)).toBe("")
  })
})

describe("showPortfolioPicker", () => {
  const one = [makePortfolio({ id: "pf-1" })]
  const two = [makePortfolio({ id: "a" }), makePortfolio({ id: "b" })]

  it("hides the picker only when zen with exactly one portfolio to target", () => {
    expect(showPortfolioPicker(one, null)).toBe(false)
  })

  it("shows the picker in master mode", () => {
    expect(showPortfolioPicker(two, null)).toBe(true)
  })

  it("shows the picker with zero portfolios (nothing to auto-target)", () => {
    expect(showPortfolioPicker([], null)).toBe(true)
  })

  it("shows the picker when explicit zen is set but several portfolios exist", () => {
    expect(showPortfolioPicker(two, prefs(true))).toBe(true)
  })
})
