import {
  personalInfoSchema,
  preRetirementSchema,
  incomeSourcesSchema,
  expenseSchema,
  goalsSchema,
  wizardSchema,
  defaultWizardValues,
} from "./schema"

const currentYear = new Date().getFullYear()

describe("personalInfoSchema", () => {
  describe("planName", () => {
    it("should require plan name", async () => {
      await expect(
        personalInfoSchema.validateAt("planName", { planName: "" }),
      ).rejects.toThrow()
    })

    it("should require minimum 3 characters", async () => {
      await expect(
        personalInfoSchema.validateAt("planName", { planName: "ab" }),
      ).rejects.toThrow("at least 3 characters")
    })

    it("should accept valid names", async () => {
      const result = await personalInfoSchema.validateAt("planName", {
        planName: "My Retirement Plan",
      })
      expect(result).toBe("My Retirement Plan")
    })

    it("should reject names over 50 characters", async () => {
      const longName = "a".repeat(51)
      await expect(
        personalInfoSchema.validateAt("planName", { planName: longName }),
      ).rejects.toThrow("50 characters or less")
    })
  })

  describe("yearOfBirth", () => {
    it("should require year of birth", async () => {
      await expect(
        personalInfoSchema.validateAt("yearOfBirth", {}),
      ).rejects.toThrow()
    })

    it("should reject years before 1920", async () => {
      await expect(
        personalInfoSchema.validateAt("yearOfBirth", { yearOfBirth: 1919 }),
      ).rejects.toThrow("1920 or later")
    })

    it("should reject users younger than 18", async () => {
      await expect(
        personalInfoSchema.validateAt("yearOfBirth", {
          yearOfBirth: currentYear - 17,
        }),
      ).rejects.toThrow()
    })

    it("should accept valid birth years", async () => {
      const result = await personalInfoSchema.validateAt("yearOfBirth", {
        yearOfBirth: 1970,
      })
      expect(result).toBe(1970)
    })
  })

  describe("targetRetirementAge", () => {
    it("should require retirement age to be at least 18", async () => {
      await expect(
        personalInfoSchema.validateAt("targetRetirementAge", {
          targetRetirementAge: 17,
        }),
      ).rejects.toThrow("at least 18")
    })

    it("should reject retirement age over 100", async () => {
      await expect(
        personalInfoSchema.validateAt("targetRetirementAge", {
          targetRetirementAge: 101,
        }),
      ).rejects.toThrow("100 or less")
    })

    it("should validate retirement age is after current age", async () => {
      const data = {
        planName: "Test Plan",
        expensesCurrency: "NZD",
        yearOfBirth: 1970,
        targetRetirementAge: 50, // Person is 54/55, so 50 is invalid
        lifeExpectancy: 90,
      }
      await expect(personalInfoSchema.validate(data)).rejects.toThrow(
        "after your current age",
      )
    })

    it("should accept valid retirement age after current age", async () => {
      const data = {
        planName: "Test Plan",
        expensesCurrency: "NZD",
        yearOfBirth: 1970,
        targetRetirementAge: 65,
        lifeExpectancy: 90,
      }
      const result = await personalInfoSchema.validate(data)
      expect(result.targetRetirementAge).toBe(65)
    })
  })

  describe("lifeExpectancy", () => {
    it("should require life expectancy to be at least 50", async () => {
      await expect(
        personalInfoSchema.validateAt("lifeExpectancy", {
          lifeExpectancy: 49,
        }),
      ).rejects.toThrow("at least 50")
    })

    it("should reject life expectancy over 120", async () => {
      await expect(
        personalInfoSchema.validateAt("lifeExpectancy", {
          lifeExpectancy: 121,
        }),
      ).rejects.toThrow("120 or less")
    })

    it("should validate life expectancy is after retirement age", async () => {
      const data = {
        planName: "Test",
        expensesCurrency: "NZD",
        yearOfBirth: 1990,
        targetRetirementAge: 70,
        lifeExpectancy: 65,
      }
      await expect(personalInfoSchema.validate(data)).rejects.toThrow(
        "after retirement age",
      )
    })
  })
})

describe("preRetirementSchema", () => {
  it("should accept zero for income and expenses", async () => {
    const data = {
      workingIncomeMonthly: 0,
      workingExpensesMonthly: 0,
      investmentAllocationPercent: 80,
    }
    const result = await preRetirementSchema.validate(data)
    expect(result.workingIncomeMonthly).toBe(0)
    expect(result.workingExpensesMonthly).toBe(0)
  })

  it("should reject negative income", async () => {
    await expect(
      preRetirementSchema.validateAt("workingIncomeMonthly", {
        workingIncomeMonthly: -100,
      }),
    ).rejects.toThrow()
  })

  it("should reject investment allocation over 100%", async () => {
    await expect(
      preRetirementSchema.validateAt("investmentAllocationPercent", {
        investmentAllocationPercent: 101,
      }),
    ).rejects.toThrow("100% or less")
  })

  it("should accept valid investment allocation", async () => {
    const result = await preRetirementSchema.validateAt(
      "investmentAllocationPercent",
      { investmentAllocationPercent: 80 },
    )
    expect(result).toBe(80)
  })
})

describe("incomeSourcesSchema", () => {
  it("should default values to 0", async () => {
    const result = await incomeSourcesSchema.validate({})
    expect(result.pensionMonthly).toBe(0)
    expect(result.socialSecurityMonthly).toBe(0)
    expect(result.otherIncomeMonthly).toBe(0)
  })

  it("should reject negative values", async () => {
    await expect(
      incomeSourcesSchema.validateAt("pensionMonthly", {
        pensionMonthly: -100,
      }),
    ).rejects.toThrow()
  })

  it("should accept positive values", async () => {
    const data = {
      pensionMonthly: 1000,
      socialSecurityMonthly: 500,
      otherIncomeMonthly: 200,
    }
    const result = await incomeSourcesSchema.validate(data)
    expect(result.pensionMonthly).toBe(1000)
    expect(result.socialSecurityMonthly).toBe(500)
    expect(result.otherIncomeMonthly).toBe(200)
  })
})

describe("expenseSchema", () => {
  it("should require categoryLabelId", async () => {
    await expect(
      expenseSchema.validate({
        categoryName: "Housing",
        monthlyAmount: 100,
      }),
    ).rejects.toThrow("Category is required")
  })

  it("should require categoryName", async () => {
    await expect(
      expenseSchema.validate({
        categoryLabelId: "housing-1",
        monthlyAmount: 100,
      }),
    ).rejects.toThrow()
  })

  it("should require positive monthlyAmount", async () => {
    await expect(
      expenseSchema.validateAt("monthlyAmount", { monthlyAmount: -50 }),
    ).rejects.toThrow()
  })

  it("should accept valid expense", async () => {
    const expense = {
      categoryLabelId: "housing-1",
      categoryName: "Housing",
      monthlyAmount: 1500,
    }
    const result = await expenseSchema.validate(expense)
    expect(result.categoryLabelId).toBe("housing-1")
    expect(result.monthlyAmount).toBe(1500)
  })
})

describe("goalsSchema", () => {
  describe("return rate validations", () => {
    it("should reject equity return rate over 30%", async () => {
      await expect(
        goalsSchema.validateAt("equityReturnRate", { equityReturnRate: 31 }),
      ).rejects.toThrow("30% or less")
    })

    it("should reject cash return rate over 20%", async () => {
      await expect(
        goalsSchema.validateAt("cashReturnRate", { cashReturnRate: 21 }),
      ).rejects.toThrow("20% or less")
    })

    it("should reject negative return rates", async () => {
      await expect(
        goalsSchema.validateAt("equityReturnRate", { equityReturnRate: -1 }),
      ).rejects.toThrow()
    })
  })

  describe("allocation validations", () => {
    it("should reject allocation over 100%", async () => {
      await expect(
        goalsSchema.validateAt("cashAllocation", { cashAllocation: 101 }),
      ).rejects.toThrow("100% or less")
    })

    it("should accept valid allocations", async () => {
      const data = {
        cashAllocation: 20,
        equityAllocation: 60,
        housingAllocation: 20,
      }
      const result = await goalsSchema.validate(data)
      expect(result.cashAllocation).toBe(20)
      expect(result.equityAllocation).toBe(60)
      expect(result.housingAllocation).toBe(20)
    })
  })

  describe("inflation rate", () => {
    it("should reject inflation over 10%", async () => {
      await expect(
        goalsSchema.validateAt("inflationRate", { inflationRate: 11 }),
      ).rejects.toThrow("10% or less")
    })

    it("should accept valid inflation rate", async () => {
      const result = await goalsSchema.validateAt("inflationRate", {
        inflationRate: 2.5,
      })
      expect(result).toBe(2.5)
    })
  })

  describe("targetBalance", () => {
    it("should allow null target balance", async () => {
      const result = await goalsSchema.validateAt("targetBalance", {
        targetBalance: null,
      })
      expect(result).toBeNull()
    })

    it("should reject negative target balance", async () => {
      await expect(
        goalsSchema.validateAt("targetBalance", { targetBalance: -1000 }),
      ).rejects.toThrow()
    })
  })
})

describe("defaultWizardValues", () => {
  it("should have all required fields", () => {
    expect(defaultWizardValues).toHaveProperty("planName")
    expect(defaultWizardValues).toHaveProperty("yearOfBirth")
    expect(defaultWizardValues).toHaveProperty("targetRetirementAge")
    expect(defaultWizardValues).toHaveProperty("lifeExpectancy")
    expect(defaultWizardValues).toHaveProperty("workingIncomeMonthly")
    expect(defaultWizardValues).toHaveProperty("workingExpensesMonthly")
    expect(defaultWizardValues).toHaveProperty("investmentAllocationPercent")
    expect(defaultWizardValues).toHaveProperty("pensionMonthly")
    expect(defaultWizardValues).toHaveProperty("socialSecurityMonthly")
    expect(defaultWizardValues).toHaveProperty("otherIncomeMonthly")
    expect(defaultWizardValues).toHaveProperty("expenses")
    expect(defaultWizardValues).toHaveProperty("expensesCurrency")
  })

  it("should have sensible defaults", () => {
    expect(defaultWizardValues.targetRetirementAge).toBe(65)
    expect(defaultWizardValues.lifeExpectancy).toBe(90)
    expect(defaultWizardValues.investmentAllocationPercent).toBe(80)
    expect(defaultWizardValues.expensesCurrency).toBe("NZD")
    expect(defaultWizardValues.expenses).toEqual([])
  })

  it("should default to age 55", () => {
    const expectedBirthYear = currentYear - 55
    expect(defaultWizardValues.yearOfBirth).toBe(expectedBirthYear)
  })

  it("should have allocation percentages that sum correctly", () => {
    const total =
      defaultWizardValues.cashAllocation +
      defaultWizardValues.equityAllocation +
      defaultWizardValues.housingAllocation
    expect(total).toBe(100)
  })
})

describe("wizardSchema", () => {
  it("should validate a complete valid form", async () => {
    const validForm = {
      planName: "My Retirement Plan",
      expensesCurrency: "NZD",
      yearOfBirth: 1970,
      targetRetirementAge: 65,
      lifeExpectancy: 90,
      workingIncomeMonthly: 5000,
      workingExpensesMonthly: 3000,
      investmentAllocationPercent: 80,
      pensionMonthly: 1000,
      socialSecurityMonthly: 500,
      otherIncomeMonthly: 0,
      expenses: [],
      targetBalance: 1000000,
      cashReturnRate: 3.5,
      equityReturnRate: 7,
      housingReturnRate: 4,
      inflationRate: 2.5,
      cashAllocation: 20,
      equityAllocation: 60,
      housingAllocation: 20,
      selectedPortfolioIds: [],
    }

    const result = await wizardSchema.validate(validForm)
    expect(result.planName).toBe("My Retirement Plan")
    expect(result.targetRetirementAge).toBe(65)
  })

  it("should reject invalid form data", async () => {
    const invalidForm = {
      planName: "ab", // Too short
      yearOfBirth: 1970,
    }

    await expect(wizardSchema.validate(invalidForm)).rejects.toThrow()
  })
})
