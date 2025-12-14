import { accountInputSchema } from "./schema"
import { describe, it, expect } from "@jest/globals"

const validCategory = { label: "Bank Account", value: "ACCOUNT" }
const validCurrency = { label: "US Dollar", value: "USD" }

describe("accountInputSchema", () => {
  it("validates a valid account input", async () => {
    const validInput = {
      code: "USD-SAVINGS",
      name: "My USD Savings Account",
      currency: validCurrency,
      category: validCategory,
    }

    await expect(accountInputSchema.validate(validInput)).resolves.toEqual(
      validInput,
    )
  })

  it("rejects code shorter than 3 characters", async () => {
    const invalidInput = {
      code: "US",
      name: "My USD Savings Account",
      currency: validCurrency,
      category: validCategory,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("rejects code longer than 20 characters", async () => {
    const invalidInput = {
      code: "THIS-CODE-IS-WAY-TOO-LONG",
      name: "My USD Savings Account",
      currency: validCurrency,
      category: validCategory,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("rejects name shorter than 5 characters", async () => {
    const invalidInput = {
      code: "USD-SAV",
      name: "Sav",
      currency: validCurrency,
      category: validCategory,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("rejects name longer than 50 characters", async () => {
    const invalidInput = {
      code: "USD-SAV",
      name: "This account name is way too long and should be rejected by the schema",
      currency: validCurrency,
      category: validCategory,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("rejects missing currency", async () => {
    const invalidInput = {
      code: "USD-SAV",
      name: "My USD Savings Account",
      category: validCategory,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("rejects missing category", async () => {
    const invalidInput = {
      code: "USD-SAV",
      name: "My USD Savings Account",
      currency: validCurrency,
    }

    await expect(accountInputSchema.validate(invalidInput)).rejects.toThrow()
  })

  it("trims whitespace from code and name", async () => {
    const inputWithWhitespace = {
      code: "  USD-SAVINGS  ",
      name: "  My USD Savings Account  ",
      currency: validCurrency,
      category: validCategory,
    }

    const result = await accountInputSchema.validate(inputWithWhitespace)
    expect(result.code).toBe("USD-SAVINGS")
    expect(result.name).toBe("My USD Savings Account")
  })
})
