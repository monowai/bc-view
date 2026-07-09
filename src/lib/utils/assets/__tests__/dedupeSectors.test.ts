import { describe, it, expect } from "@jest/globals"
import { dedupeSectorsByName } from "@utils/assets/dedupeSectors"

describe("dedupeSectorsByName", () => {
  it("collapses a name shared across standards to one entry, preferring ALPHA", () => {
    const result = dedupeSectorsByName([
      {
        code: "INFORMATION_TECHNOLOGY",
        name: "Information Technology",
        standard: "USER",
      },
      {
        code: "COMMUNICATION_SERVICES",
        name: "Communication Services",
        standard: "ALPHA",
      },
      {
        code: "INFORMATION_TECHNOLOGY",
        name: "Information Technology",
        standard: "ALPHA",
      },
    ])

    expect(result).toHaveLength(2)
    const it = result.find((s) => s.name === "Information Technology")
    expect(it?.standard).toBe("ALPHA")
  })

  it("keeps a user-only sector that has no provider twin", () => {
    const result = dedupeSectorsByName([
      { code: "LARGE_BLEND", name: "Large Blend", standard: "USER" },
    ])

    expect(result).toEqual([
      { code: "LARGE_BLEND", name: "Large Blend", standard: "USER" },
    ])
  })
})
