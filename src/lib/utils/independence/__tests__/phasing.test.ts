import {
  PHASING_PREREQUISITE_MESSAGE,
  phaseFailureMessage,
} from "@lib/independence/phasing"

describe("phasing copy", () => {
  it("names both ways to satisfy the prerequisite, and what it costs", () => {
    expect(PHASING_PREREQUISITE_MESSAGE).toMatch(/date of birth/i)
    expect(PHASING_PREREQUISITE_MESSAGE).toMatch(/target independence age/i)
    expect(PHASING_PREREQUISITE_MESSAGE).toMatch(/cannot be phased/i)
  })

  it("says the stage survived, then quotes the reason unedited", () => {
    expect(
      phaseFailureMessage(
        "Set a target independence age or year of birth before generating phases",
      ),
    ).toBe(
      "Your stage is saved, but it could not be phased: Set a target " +
        "independence age or year of birth before generating phases.",
    )
  })

  it("carries no link text — each surface points somewhere different", () => {
    const message = phaseFailureMessage("whatever the backend said")
    expect(message).not.toMatch(/stages list/i)
    expect(message).not.toMatch(/independence page/i)
  })
})
