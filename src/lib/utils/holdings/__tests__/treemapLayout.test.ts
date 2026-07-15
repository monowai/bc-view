import { squarify, TreemapRect } from "../treemapLayout"

function totalArea(rects: TreemapRect[]): number {
  return rects.reduce((sum, r) => sum + r.width * r.height, 0)
}

function overlaps(a: TreemapRect, b: TreemapRect): boolean {
  // Allow a tiny epsilon for floating point edges touching.
  const EPS = 1e-6
  return (
    a.x + a.width > b.x + EPS &&
    b.x + b.width > a.x + EPS &&
    a.y + a.height > b.y + EPS &&
    b.y + b.height > a.y + EPS
  )
}

function worstAspectRatio(rects: TreemapRect[]): number {
  return rects.reduce((worst, r) => {
    if (r.width === 0 || r.height === 0) return worst
    const ratio = Math.max(r.width / r.height, r.height / r.width)
    return Math.max(worst, ratio)
  }, 0)
}

describe("squarify", () => {
  it("returns an empty array for empty input", () => {
    expect(squarify([], 400, 300)).toEqual([])
  })

  it("fills the entire container for a single item", () => {
    const result = squarify([{ value: 100, data: "A" }], 400, 300)
    expect(result).toHaveLength(1)
    const rect = result[0]
    expect(rect.x).toBeCloseTo(0)
    expect(rect.y).toBeCloseTo(0)
    expect(rect.width).toBeCloseTo(400)
    expect(rect.height).toBeCloseTo(300)
    expect(rect.data).toBe("A")
  })

  it("produces rects whose total area matches the container (proportional to value)", () => {
    const items = [
      { value: 500, data: "A" },
      { value: 300, data: "B" },
      { value: 150, data: "C" },
      { value: 50, data: "D" },
    ]
    const width = 600
    const height = 400
    const result = squarify(items, width, height)
    const containerArea = width * height
    const area = totalArea(result)
    expect(area).toBeGreaterThan(containerArea * 0.995)
    expect(area).toBeLessThan(containerArea * 1.005)
  })

  it("gives each rect area proportional to its value", () => {
    const items = [
      { value: 500, data: "A" },
      { value: 300, data: "B" },
      { value: 150, data: "C" },
      { value: 50, data: "D" },
    ]
    const width = 600
    const height = 400
    const containerArea = width * height
    const totalValue = 1000
    const result = squarify(items, width, height)
    const byData = new Map(result.map((r) => [r.data, r]))

    for (const item of items) {
      const rect = byData.get(item.data)!
      const expectedArea = (item.value / totalValue) * containerArea
      const actualArea = rect.width * rect.height
      expect(actualArea).toBeGreaterThan(expectedArea * 0.995)
      expect(actualArea).toBeLessThan(expectedArea * 1.005)
    }
  })

  it("keeps all rects within container bounds", () => {
    const items = [
      { value: 40, data: "A" },
      { value: 35, data: "B" },
      { value: 25, data: "C" },
      { value: 20, data: "D" },
      { value: 15, data: "E" },
      { value: 10, data: "F" },
    ]
    const width = 500
    const height = 350
    const result = squarify(items, width, height)
    for (const r of result) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6)
      expect(r.y).toBeGreaterThanOrEqual(-1e-6)
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1e-6)
      expect(r.y + r.height).toBeLessThanOrEqual(height + 1e-6)
    }
  })

  it("does not overlap rects (pairwise check)", () => {
    const items = [
      { value: 40, data: "A" },
      { value: 35, data: "B" },
      { value: 25, data: "C" },
      { value: 20, data: "D" },
      { value: 15, data: "E" },
      { value: 10, data: "F" },
      { value: 5, data: "G" },
    ]
    const result = squarify(items, 500, 350)
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        expect(overlaps(result[i], result[j])).toBe(false)
      }
    }
  })

  it("skips zero/negative value items", () => {
    const items = [
      { value: 100, data: "A" },
      { value: 0, data: "B" },
      { value: -5, data: "C" },
    ]
    const result = squarify(items, 400, 300)
    expect(result.some((r) => r.data === "B")).toBe(false)
    expect(result.some((r) => r.data === "C")).toBe(false)
    expect(result.some((r) => r.data === "A")).toBe(true)
  })

  it("keeps worst aspect ratio reasonable for equal values in a square container", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      value: 10,
      data: `item-${i}`,
    }))
    const result = squarify(items, 300, 300)
    expect(result).toHaveLength(9)
    expect(worstAspectRatio(result)).toBeLessThan(3)
  })

  it("handles all-zero values by returning no rects", () => {
    const items = [
      { value: 0, data: "A" },
      { value: 0, data: "B" },
    ]
    expect(squarify(items, 400, 300)).toEqual([])
  })

  it("handles zero-size container by returning empty rects with zero area", () => {
    const items = [
      { value: 10, data: "A" },
      { value: 20, data: "B" },
    ]
    const result = squarify(items, 0, 300)
    expect(totalArea(result)).toBeCloseTo(0)
  })
})
