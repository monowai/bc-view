import { LifeEvent } from "types/independence"
import { serializeLifeEvents } from "./planHelpers"

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
