import type { IndependencePlan, RetirementPlan } from "types/independence"
import {
  isJourneyPhased,
  journeyPhasePlans,
  landingPlan,
  parseJourneyPhases,
  primaryJourney,
} from "./journeyPhases"

function makeJourney(
  overrides: Partial<IndependencePlan> & { id: string },
): IndependencePlan {
  return {
    ownerId: "owner-1",
    name: "With Property",
    isPrimary: false,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    ...overrides,
  }
}

function makePlan(
  overrides: Partial<RetirementPlan> & { id: string },
): RetirementPlan {
  return {
    name: `Plan ${overrides.id}`,
    ownerId: "owner-1",
    isPrimary: false,
    ...overrides,
  } as RetirementPlan
}

describe("parseJourneyPhases", () => {
  it("reads a well-formed timeline", () => {
    const journey = makeJourney({
      id: "j1",
      phases: JSON.stringify([
        { planId: "p1", fromAge: 60, toAge: 70 },
        { planId: "p2", fromAge: 70 },
      ]),
    })

    expect(parseJourneyPhases(journey)).toEqual([
      { planId: "p1", fromAge: 60, toAge: 70 },
      { planId: "p2", fromAge: 70 },
    ])
  })

  it.each([
    ["no journey", undefined],
    ["a journey that was never phased", makeJourney({ id: "j1" })],
    ["unparseable JSON", makeJourney({ id: "j1", phases: "{oops" })],
    ["JSON that isn't an array", makeJourney({ id: "j1", phases: '{"a":1}' })],
  ])("reads %s as not phased", (_label, journey) => {
    expect(parseJourneyPhases(journey)).toEqual([])
    expect(isJourneyPhased(journey)).toBe(false)
  })

  it("drops a phase naming no plan", () => {
    const journey = makeJourney({
      id: "j1",
      phases: JSON.stringify([{ planId: "", fromAge: 60 }, { fromAge: 70 }]),
    })

    expect(parseJourneyPhases(journey)).toEqual([])
  })

  // The timeline is *ordered* by fromAge, so a phase without a usable one is
  // not a phase — it would sort on NaN and scramble its neighbours.
  it.each([
    ["absent", { planId: "p1" }],
    ["null", { planId: "p1", fromAge: null }],
    ["a string", { planId: "p1", fromAge: "60" }],
    ["NaN", { planId: "p1", fromAge: Number.NaN }],
  ])("drops a phase whose fromAge is %s", (_label, phase) => {
    const journey = makeJourney({
      id: "j1",
      phases: JSON.stringify([phase, { planId: "p2", fromAge: 70 }]),
    })

    expect(parseJourneyPhases(journey)).toEqual([{ planId: "p2", fromAge: 70 }])
  })
})

describe("journeyPhasePlans", () => {
  const p1 = makePlan({ id: "p1", independencePlanId: "j1" })
  const p2 = makePlan({ id: "p2", independencePlanId: "j1" })
  const p3 = makePlan({ id: "p3", independencePlanId: "j1" })

  it("orders by the journey's own timeline, not by the plans array", () => {
    const journey = makeJourney({
      id: "j1",
      phases: JSON.stringify([
        { planId: "p3", fromAge: 80 },
        { planId: "p1", fromAge: 60 },
        { planId: "p2", fromAge: 70 },
      ]),
    })

    expect(journeyPhasePlans(journey, [p1, p2, p3]).map((p) => p.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ])
  })

  it("keeps a stable order when one phase carries no usable age", () => {
    // With the age unvalidated this sorted on NaN, and which of p1/p2 came
    // first depended on the engine's sort implementation.
    const journey = makeJourney({
      id: "j1",
      phases: JSON.stringify([
        { planId: "p2", fromAge: 70 },
        { planId: "p3" },
        { planId: "p1", fromAge: 60 },
      ]),
    })

    expect(journeyPhasePlans(journey, [p1, p2, p3]).map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ])
  })

  it("falls back to the link column before the journey is phased", () => {
    const journey = makeJourney({ id: "j1" })
    const other = makePlan({ id: "px", independencePlanId: "j2" })

    expect(journeyPhasePlans(journey, [p1, other]).map((p) => p.id)).toEqual([
      "p1",
    ])
  })

  it("claims a lone unlinked legacy row, but never an ambiguous pair", () => {
    const journey = makeJourney({ id: "j1" })
    const legacyA = makePlan({ id: "legacy-a" })
    const legacyB = makePlan({ id: "legacy-b" })

    expect(journeyPhasePlans(journey, [legacyA]).map((p) => p.id)).toEqual([
      "legacy-a",
    ])
    expect(journeyPhasePlans(journey, [legacyA, legacyB])).toEqual([])
  })

  it("yields nothing without a journey", () => {
    expect(journeyPhasePlans(undefined, [p1, p2])).toEqual([])
  })
})

describe("primaryJourney", () => {
  it("prefers the journey flagged primary", () => {
    const journeys = [
      makeJourney({ id: "j1", name: "Auckland" }),
      makeJourney({ id: "j2", name: "Zurich", isPrimary: true }),
    ]

    expect(primaryJourney(journeys)?.id).toBe("j2")
  })

  it("falls back to the first by name, not the first in the array", () => {
    const journeys = [
      makeJourney({ id: "j1", name: "Zurich" }),
      makeJourney({ id: "j2", name: "Auckland" }),
    ]

    expect(primaryJourney(journeys)?.id).toBe("j2")
  })

  it("does not reorder the caller's array", () => {
    const journeys = [
      makeJourney({ id: "j1", name: "Zurich" }),
      makeJourney({ id: "j2", name: "Auckland" }),
    ]
    primaryJourney(journeys)

    expect(journeys.map((j) => j.id)).toEqual(["j1", "j2"])
  })

  it("yields nothing when the user owns none", () => {
    expect(primaryJourney([])).toBeUndefined()
  })
})

describe("landingPlan", () => {
  it("prefers the plan flagged primary", () => {
    const plans = [
      makePlan({ id: "slow-go" }),
      makePlan({ id: "go-go", isPrimary: true }),
    ]

    expect(landingPlan(plans)?.id).toBe("go-go")
  })

  it("falls back to the first plan in the list", () => {
    const plans = [makePlan({ id: "slow-go" }), makePlan({ id: "no-go" })]

    expect(landingPlan(plans)?.id).toBe("slow-go")
  })

  it("resolves within the list it is given, not across journeys", () => {
    // `isPrimary` is scoped per journey (svc-retire#248), so an account can
    // hold several primaries at once. Scoping is the caller's job: pass one
    // journey's phase plans and only that journey's default can win.
    const owning = makePlan({
      id: "own-go-go",
      isPrimary: true,
      independencePlanId: "j-own",
    })
    const renting = makePlan({
      id: "rent-go-go",
      isPrimary: true,
      independencePlanId: "j-rent",
    })

    expect(landingPlan([renting, owning])?.id).toBe("rent-go-go")
    expect(landingPlan([owning])?.id).toBe("own-go-go")
  })

  it("yields nothing for an empty list", () => {
    expect(landingPlan([])).toBeUndefined()
  })
})
