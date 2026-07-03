import { holdingsHighlightHref } from "../holdingsHref"

describe("holdingsHighlightHref", () => {
  it("builds the holdings path with the asset highlight hash", () => {
    expect(holdingsHighlightHref("TEST", "abc123")).toBe(
      "/holdings/TEST#asset-abc123",
    )
  })

  it("URL-encodes the asset id in the hash", () => {
    expect(holdingsHighlightHref("TEST", "a/b c")).toBe(
      "/holdings/TEST#asset-a%2Fb%20c",
    )
  })

  it("URL-encodes the portfolio code in the path segment", () => {
    expect(holdingsHighlightHref("MY PORT", "abc")).toBe(
      "/holdings/MY%20PORT#asset-abc",
    )
  })
})
