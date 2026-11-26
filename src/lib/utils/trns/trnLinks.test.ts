import {
  cashLadderHref,
  highlightedTrnId,
  tradesHighlightHref,
} from "./trnLinks"

describe("trnLinks", () => {
  it("names the transaction to flash in the cash ladder link", () => {
    expect(cashLadderHref("p1", "c1", "t1")).toBe(
      "/trns/cash-ladder/p1/c1#trn-t1",
    )
  })

  it("names the transaction to flash in the trades link", () => {
    expect(tradesHighlightHref("p1", "a1", "t1")).toBe(
      "/trns/trades/p1/a1#trn-t1",
    )
  })

  it("reads the transaction back from the fragment", () => {
    expect(highlightedTrnId("#trn-t1")).toBe("t1")
    expect(highlightedTrnId(`#trn-${encodeURIComponent("a b")}`)).toBe("a b")
  })

  it("reads nothing from any other fragment", () => {
    expect(highlightedTrnId("")).toBeUndefined()
    expect(highlightedTrnId("#asset-a1")).toBeUndefined()
    expect(highlightedTrnId("#trn-")).toBeUndefined()
  })
})
