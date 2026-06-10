import { independenceFeatureFlags } from "./featureFlags"

describe("independenceFeatureFlags", () => {
  it("hides the CPF MA row inside the Retirement Fund expander by default", () => {
    // Off because MA is already surfaced under Non-Spendable as the
    // Healthcare Reserve line; rendering it inside the expander too
    // shows the same balance on the page twice. Flip to true if we
    // want the per-sub-account breakdown back.
    expect(independenceFeatureFlags.showCpfMaInRetirementExpander).toBe(false)
  })
})
