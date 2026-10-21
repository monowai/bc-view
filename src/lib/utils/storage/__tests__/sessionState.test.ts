import {
  createSessionState,
  getSessionValue,
  setSessionValue,
} from "@lib/storage/sessionState"

describe("sessionState", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("returns the default when nothing is stored", () => {
    expect(getSessionValue("missing", 42)).toBe(42)
  })

  it("round-trips a JSON value under the bc: prefix", () => {
    setSessionValue("proposed-from", "2020-01-01")
    expect(sessionStorage.getItem("bc:proposed-from")).toBe('"2020-01-01"')
    expect(getSessionValue("proposed-from", "")).toBe("2020-01-01")
  })

  it("returns the default when the stored value is not JSON", () => {
    sessionStorage.setItem("bc:broken", "{not json")
    expect(getSessionValue("broken", false)).toBe(false)
  })

  it("notifies subscribers on set", () => {
    const state = createSessionState("flag", false)
    const seen: boolean[] = []
    const unsubscribe = state.subscribe((v) => seen.push(v))
    state.set(true)
    unsubscribe()
    state.set(false)
    expect(seen).toEqual([true])
    expect(state.get()).toBe(false)
  })
})
