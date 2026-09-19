import {
  WIZARD_STEPS,
  TOTAL_STEPS,
  getStepFields,
  stepIdForSlug,
} from "./stepConfig"

describe("WIZARD_STEPS", () => {
  it("should have 5 steps", () => {
    expect(WIZARD_STEPS).toHaveLength(5)
  })

  it("no longer offers a Wealth step", () => {
    // Wealth belongs to the journey — AllocationResolver reads
    // `journey.excludedPortfolioIds ?: plan.…`, so the per-stage column this
    // step wrote is unreachable for any stage created since svc-retire#265.
    expect(WIZARD_STEPS.map((s) => s.slug)).not.toContain("wealth")
    expect(WIZARD_STEPS.flatMap((s) => s.fields)).not.toContain(
      "selectedPortfolioIds",
    )
    expect(WIZARD_STEPS.flatMap((s) => s.fields)).not.toContain("manualAssets")
  })

  it("should have sequential step IDs starting from 1", () => {
    WIZARD_STEPS.forEach((step, index) => {
      expect(step.id).toBe(index + 1)
    })
  })

  it("should have correct step names", () => {
    expect(WIZARD_STEPS[0].name).toBe("Personal Info")
    expect(WIZARD_STEPS[1].name).toBe("Assumptions")
    expect(WIZARD_STEPS[2].name).toBe("Income")
    expect(WIZARD_STEPS[3].name).toBe("Expenses")
    expect(WIZARD_STEPS[4].name).toBe("Life Events")
  })

  it("should have non-empty fields array for each step", () => {
    WIZARD_STEPS.forEach((step) => {
      expect(step.fields.length).toBeGreaterThan(0)
    })
  })

  it("should have a Font Awesome icon class for each step", () => {
    WIZARD_STEPS.forEach((step) => {
      expect(step.icon).toMatch(/^fa-[\w-]+$/)
    })
  })

  describe("Step 1 - Personal Info", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[0].fields
      expect(fields).toContain("planName")
      expect(fields).toContain("expensesCurrency")
      // yearOfBirth, targetRetirementAge, lifeExpectancy moved to user-level settings
      expect(fields).not.toContain("yearOfBirth")
      expect(fields).not.toContain("targetRetirementAge")
      expect(fields).not.toContain("lifeExpectancy")
    })
  })

  describe("Step 2 - Assumptions", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[1].fields
      expect(fields).toContain("targetBalance")
      expect(fields).toContain("cashReturnRate")
      expect(fields).toContain("equityReturnRate")
      expect(fields).toContain("housingReturnRate")
      expect(fields).toContain("inflationRate")
      expect(fields).toContain("cashAllocation")
      expect(fields).toContain("equityAllocation")
      expect(fields).toContain("housingAllocation")
    })

    it("validates the journey-inherit switch as part of the step", () => {
      // The switch lives on step 2, so the step's trigger must see the field —
      // otherwise a per-step validate never covers it.
      expect(getStepFields(2)).toContain("assumptionsInherited")
    })
  })

  describe("Step 3 - Income", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[2].fields
      expect(fields).toContain("pensionMonthly")
      expect(fields).toContain("socialSecurityMonthly")
      expect(fields).toContain("otherIncomeMonthly")
    })
  })

  describe("Step 4 - Expenses", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[3].fields
      expect(fields).toContain("expenses")
    })
  })

  describe("Step 5 - Life Events", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[4].fields
      expect(fields).toContain("lifeEvents")
    })
  })
})

describe("TOTAL_STEPS", () => {
  it("should equal the number of wizard steps", () => {
    expect(TOTAL_STEPS).toBe(WIZARD_STEPS.length)
    expect(TOTAL_STEPS).toBe(5)
  })
})

describe("getStepFields", () => {
  it("should return fields for valid step numbers", () => {
    expect(getStepFields(1)).toEqual(WIZARD_STEPS[0].fields)
    expect(getStepFields(2)).toEqual(WIZARD_STEPS[1].fields)
    expect(getStepFields(3)).toEqual(WIZARD_STEPS[2].fields)
    expect(getStepFields(4)).toEqual(WIZARD_STEPS[3].fields)
    expect(getStepFields(5)).toEqual(WIZARD_STEPS[4].fields)
  })

  it("should return empty array for invalid step numbers", () => {
    expect(getStepFields(0)).toEqual([])
    expect(getStepFields(-1)).toEqual([])
    expect(getStepFields(6)).toEqual([])
    expect(getStepFields(100)).toEqual([])
  })

  it("should return correct number of fields for each step", () => {
    expect(getStepFields(1)).toHaveLength(4) // Personal Info (planName, expensesCurrency, country, narrative)
    expect(getStepFields(2)).toHaveLength(9) // Assumptions (incl. the inherit switch)
    expect(getStepFields(3)).toHaveLength(3) // Income
    expect(getStepFields(4)).toHaveLength(1) // Expenses
    expect(getStepFields(5)).toHaveLength(1) // Life Events
  })
})

describe("stepIdForSlug", () => {
  it("maps every step's slug back to its id", () => {
    WIZARD_STEPS.forEach((step) => {
      expect(stepIdForSlug(step.slug)).toBe(step.id)
    })
  })

  it("deep-links the expenses step, which is what a spend board links to", () => {
    expect(stepIdForSlug("expenses")).toBe(4)
  })

  it("is case-insensitive and tolerates surrounding whitespace", () => {
    expect(stepIdForSlug(" Expenses ")).toBe(4)
  })

  it("returns undefined for anything it doesn't recognise", () => {
    expect(stepIdForSlug("nope")).toBeUndefined()
    expect(stepIdForSlug("")).toBeUndefined()
    expect(stepIdForSlug(undefined)).toBeUndefined()
    // A query param can arrive as string[] when repeated; not a slug.
    expect(stepIdForSlug(["expenses"] as unknown as string)).toBeUndefined()
  })

  it("gives every step a unique, url-safe slug", () => {
    const slugs = WIZARD_STEPS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    slugs.forEach((slug) => expect(slug).toMatch(/^[a-z][a-z-]*$/))
  })
})
