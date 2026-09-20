import { shouldRouteToOnboarding } from "../shouldRouteToOnboarding"

describe("shouldRouteToOnboarding", () => {
  it("routes a brand-new account with nothing in it", () => {
    expect(
      shouldRouteToOnboarding({
        isNewlyRegistered: true,
        portfolioCount: 0,
        onboardingComplete: false,
      }),
    ).toBe(true)
  })

  it("never routes a returning user", () => {
    expect(
      shouldRouteToOnboarding({
        isNewlyRegistered: false,
        portfolioCount: 0,
        onboardingComplete: false,
      }),
    ).toBe(false)
  })

  it("never routes a user who already owns a portfolio", () => {
    expect(
      shouldRouteToOnboarding({
        isNewlyRegistered: true,
        portfolioCount: 1,
        onboardingComplete: false,
      }),
    ).toBe(false)
  })

  it("never routes a user whose onboarding is already marked complete", () => {
    expect(
      shouldRouteToOnboarding({
        isNewlyRegistered: true,
        portfolioCount: 0,
        onboardingComplete: true,
      }),
    ).toBe(false)
  })

  it("stays put when every veto applies at once", () => {
    expect(
      shouldRouteToOnboarding({
        isNewlyRegistered: false,
        portfolioCount: 3,
        onboardingComplete: true,
      }),
    ).toBe(false)
  })
})
