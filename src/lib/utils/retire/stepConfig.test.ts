import { WIZARD_STEPS, TOTAL_STEPS, getStepFields } from "./stepConfig"

describe("WIZARD_STEPS", () => {
  it("should have 6 steps", () => {
    expect(WIZARD_STEPS).toHaveLength(6)
  })

  it("should have sequential step IDs starting from 1", () => {
    WIZARD_STEPS.forEach((step, index) => {
      expect(step.id).toBe(index + 1)
    })
  })

  it("should have correct step names", () => {
    expect(WIZARD_STEPS[0].name).toBe("Personal Info")
    expect(WIZARD_STEPS[1].name).toBe("Goals")
    expect(WIZARD_STEPS[2].name).toBe("Life Events")
    expect(WIZARD_STEPS[3].name).toBe("Income")
    expect(WIZARD_STEPS[4].name).toBe("Employment")
    expect(WIZARD_STEPS[5].name).toBe("Expenses")
  })

  it("should have non-empty fields array for each step", () => {
    WIZARD_STEPS.forEach((step) => {
      expect(step.fields.length).toBeGreaterThan(0)
    })
  })

  describe("Step 1 - Personal Info", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[0].fields
      expect(fields).toContain("planName")
      expect(fields).toContain("yearOfBirth")
      expect(fields).toContain("targetRetirementAge")
      expect(fields).toContain("lifeExpectancy")
      expect(fields).toContain("expensesCurrency")
    })
  })

  describe("Step 2 - Goals", () => {
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
      expect(fields).toContain("selectedPortfolioIds")
    })
  })

  describe("Step 3 - Life Events", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[2].fields
      expect(fields).toContain("lifeEvents")
    })
  })

  describe("Step 4 - Income", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[3].fields
      expect(fields).toContain("pensionMonthly")
      expect(fields).toContain("socialSecurityMonthly")
      expect(fields).toContain("otherIncomeMonthly")
    })
  })

  describe("Step 5 - Employment", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[4].fields
      expect(fields).toContain("workingIncomeMonthly")
      expect(fields).toContain("workingExpensesMonthly")
      expect(fields).toContain("investmentAllocationPercent")
    })
  })

  describe("Step 6 - Expenses", () => {
    it("should contain expected fields", () => {
      const fields = WIZARD_STEPS[5].fields
      expect(fields).toContain("expenses")
    })
  })
})

describe("TOTAL_STEPS", () => {
  it("should equal the number of wizard steps", () => {
    expect(TOTAL_STEPS).toBe(WIZARD_STEPS.length)
    expect(TOTAL_STEPS).toBe(6)
  })
})

describe("getStepFields", () => {
  it("should return fields for valid step numbers", () => {
    expect(getStepFields(1)).toEqual(WIZARD_STEPS[0].fields)
    expect(getStepFields(2)).toEqual(WIZARD_STEPS[1].fields)
    expect(getStepFields(3)).toEqual(WIZARD_STEPS[2].fields)
    expect(getStepFields(4)).toEqual(WIZARD_STEPS[3].fields)
    expect(getStepFields(5)).toEqual(WIZARD_STEPS[4].fields)
    expect(getStepFields(6)).toEqual(WIZARD_STEPS[5].fields)
  })

  it("should return empty array for invalid step numbers", () => {
    expect(getStepFields(0)).toEqual([])
    expect(getStepFields(-1)).toEqual([])
    expect(getStepFields(7)).toEqual([])
    expect(getStepFields(100)).toEqual([])
  })

  it("should return correct number of fields for each step", () => {
    expect(getStepFields(1)).toHaveLength(5) // Personal Info
    expect(getStepFields(2)).toHaveLength(9) // Goals
    expect(getStepFields(3)).toHaveLength(1) // Life Events
    expect(getStepFields(4)).toHaveLength(3) // Income
    expect(getStepFields(5)).toHaveLength(3) // Employment
    expect(getStepFields(6)).toHaveLength(1) // Expenses
  })
})
