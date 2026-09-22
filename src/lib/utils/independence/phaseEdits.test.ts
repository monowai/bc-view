import type { CompositePhase } from "types/independence"
import { movePhase, setBoundaryAge } from "./phaseEdits"

const phases: CompositePhase[] = [
  { planId: "a", fromAge: 61, toAge: 70 },
  { planId: "b", fromAge: 70, toAge: 80 },
  { planId: "c", fromAge: 80 },
]

describe("setBoundaryAge", () => {
  it("moves the first stage's start on its own", () => {
    const out = setBoundaryAge(phases, 0, 62)
    expect(out[0]).toEqual({ planId: "a", fromAge: 62, toAge: 70 })
    expect(out[1]).toEqual(phases[1])
  })

  it("moves a seam for both stages that share it", () => {
    const out = setBoundaryAge(phases, 1, 72)
    expect(out[0].toAge).toBe(72)
    expect(out[1].fromAge).toBe(72)
    expect(out[2]).toEqual(phases[2])
  })

  it("rounds to a whole age", () => {
    expect(setBoundaryAge(phases, 2, 79.6)[2].fromAge).toBe(80)
  })

  it("never mutates its input", () => {
    setBoundaryAge(phases, 1, 75)
    expect(phases[1].fromAge).toBe(70)
  })

  it("ignores a boundary that does not exist", () => {
    expect(setBoundaryAge(phases, 3, 85)).toBe(phases)
    expect(setBoundaryAge(phases, -1, 85)).toBe(phases)
  })
})

describe("movePhase", () => {
  it("swaps the plan into the earlier window, keeping the ages", () => {
    const out = movePhase(phases, 1, "earlier")
    expect(out.map((p) => p.planId)).toEqual(["b", "a", "c"])
    expect(out.map((p) => [p.fromAge, p.toAge])).toEqual([
      [61, 70],
      [70, 80],
      [80, undefined],
    ])
  })

  it("swaps the plan into the later window", () => {
    expect(movePhase(phases, 1, "later").map((p) => p.planId)).toEqual([
      "a",
      "c",
      "b",
    ])
  })

  it("is a no-op at either end", () => {
    expect(movePhase(phases, 0, "earlier")).toBe(phases)
    expect(movePhase(phases, 2, "later")).toBe(phases)
  })
})
