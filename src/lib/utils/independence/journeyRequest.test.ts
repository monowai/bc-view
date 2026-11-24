import { makeJourney, makePlan } from "@test-fixtures/independence"
import { compositeProjectionUrl } from "@utils/api/client/independence"
import {
  compositeRequest,
  journeyDisplayCurrency,
  savedJourneyProjection,
} from "./journeyRequest"

const phases = [
  { planId: "plan-go", fromAge: 60, toAge: 75 },
  { planId: "plan-slow", fromAge: 75 },
]

describe("journeyDisplayCurrency", () => {
  const landing = makePlan({ expensesCurrency: "SGD" })

  it("is the journey's saved currency", () => {
    expect(journeyDisplayCurrency("NZD", landing)).toBe("NZD")
  })

  it("falls back to the landing plan's currency", () => {
    expect(journeyDisplayCurrency(undefined, landing)).toBe("SGD")
    expect(journeyDisplayCurrency("", landing)).toBe("SGD")
  })

  it("falls back to USD with neither", () => {
    expect(journeyDisplayCurrency(undefined, undefined)).toBe("USD")
  })
})

describe("compositeRequest", () => {
  it("names the work scenario only when there is one", () => {
    expect(compositeRequest("NZD", phases, undefined)).toEqual({
      displayCurrency: "NZD",
      phases,
    })
    expect(compositeRequest("NZD", phases, "ws-1")).toEqual({
      displayCurrency: "NZD",
      phases,
      workScenarioId: "ws-1",
    })
  })
})

describe("savedJourneyProjection", () => {
  const journey = makeJourney({
    id: "jrn-1",
    displayCurrency: "NZD",
    workScenarioId: "ws-1",
    phases: JSON.stringify(phases),
  })

  it("builds the request and its key from the journey as saved", () => {
    expect(savedJourneyProjection(journey, undefined)).toEqual({
      request: { displayCurrency: "NZD", phases, workScenarioId: "ws-1" },
      key: [compositeProjectionUrl, "jrn-1", journey.phases, "NZD", "ws-1"],
    })
  })

  it("projects in the landing plan's currency when the journey saved none", () => {
    const saved = savedJourneyProjection(
      { ...journey, displayCurrency: undefined },
      makePlan({ expensesCurrency: "SGD" }),
    )
    expect(saved?.request.displayCurrency).toBe("SGD")
    expect(saved?.key).toContain("SGD")
  })

  it("has nothing to project without a journey or a timeline", () => {
    expect(savedJourneyProjection(undefined, undefined)).toBeNull()
    expect(
      savedJourneyProjection({ ...journey, phases: undefined }, undefined),
    ).toBeNull()
  })
})
