import { schema, defaultValues } from "./tradeFormConfig"

const trade = (type: string, quantity: number): Record<string, unknown> => ({
  ...defaultValues,
  type: { value: type, label: type },
  asset: "ABC",
  market: "US",
  tradeCurrency: { value: "USD", label: "USD" },
  quantity,
  price: 10,
})

describe("trade schema: quantity", () => {
  test.each(["BUY", "SELL", "ADD", "REDUCE"])(
    "a %s of zero shares is refused",
    async (type) => {
      await expect(schema.validate(trade(type, 0))).rejects.toThrow(
        "Quantity must be more than 0",
      )
    },
  )

  test.each(["BUY", "SELL"])("a %s of one share is accepted", async (type) => {
    await expect(schema.validate(trade(type, 1))).resolves.toBeTruthy()
  })

  test.each(["INCOME", "EXPENSE", "DIVI"])(
    "a %s needs no quantity",
    async (type) => {
      await expect(schema.validate(trade(type, 0))).resolves.toBeTruthy()
    },
  )
})
