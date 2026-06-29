import { LifeEvent } from "types/independence"
import { normalizeAllocation, serializeLifeEvents } from "./planHelpers"

describe("normalizeAllocation", () => {
  it("returns values summing to 100 when CPF reduces raw sum below 100", () => {
    // e.g. equity=42, cash=18, housing=10 → raw sum 70 (CPF holds 30%)
    const result = normalizeAllocation(42, 18, 10)
    expect(result.equity + result.cash + result.housing).toBe(100)
    expect(result.equity).toBe(60) // 42/70 * 100
    expect(result.cash).toBe(26) // 18/70 * 100
    expect(result.housing).toBe(14) // remainder
  })

  it("returns unchanged integers when values already sum to 100", () => {
    const result = normalizeAllocation(60, 30, 10)
    expect(result).toEqual({ equity: 60, cash: 30, housing: 10 })
  })

  it("returns zeros when all inputs are zero", () => {
    expect(normalizeAllocation(0, 0, 0)).toEqual({
      equity: 0,
      cash: 0,
      housing: 0,
    })
  })
})

describe("serializeLifeEvents", () => {
  it("serialises a populated array as a JSON string the backend can parse", () => {
    const events: LifeEvent[] = [
      {
        id: "a",
        age: 62,
        amount: 60000,
        description: "tax",
        eventType: "expense",
      },
    ]
    expect(serializeLifeEvents(events)).toBe(JSON.stringify(events))
  })

  it("returns the empty-array JSON literal '[]' when no events remain", () => {
    // Regression: previously the wizard sent `undefined` once the user
    // deleted the last (or only) life event. The backend's PATCH semantics
    // treat null/missing as "no change", so the deleted event came back on
    // refresh. Sending an explicit "[]" tells svc-retire to clear the list.
    expect(serializeLifeEvents([])).toBe("[]")
  })

  it("treats undefined as an empty list and serialises '[]'", () => {
    expect(serializeLifeEvents(undefined)).toBe("[]")
  })
})
