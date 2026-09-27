import { withdrawalOrderLabel } from "./withdrawalOrder"

describe("withdrawalOrderLabel", () => {
  it("labels DEFERRED_FIRST as Tax-deferred first", () => {
    expect(withdrawalOrderLabel("DEFERRED_FIRST")).toBe("Tax-deferred first")
  })

  it("labels TAX_FREE_FIRST as Tax-free first", () => {
    expect(withdrawalOrderLabel("TAX_FREE_FIRST")).toBe("Tax-free first")
  })

  it("labels PRO_RATA as Pro rata", () => {
    expect(withdrawalOrderLabel("PRO_RATA")).toBe("Pro rata")
  })

  it("falls back to the raw string for an unknown value", () => {
    expect(withdrawalOrderLabel("SOMETHING_ELSE")).toBe("SOMETHING_ELSE")
  })
})
