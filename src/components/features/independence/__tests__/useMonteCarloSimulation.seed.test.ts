import { renderHook, act } from "@testing-library/react"
import { useMonteCarloSimulation } from "@components/features/independence/useMonteCarloSimulation"
import { fixtureMonteCarloResult } from "@components/features/independence/__fixtures__/monteCarloResult"
import type { RetirementPlan } from "types/independence"

const plan = { id: "plan-1", expensesCurrency: "SGD" } as RetirementPlan
const assets = {
  liquidAssets: 100000,
  nonSpendableAssets: 0,
  totalAssets: 100000,
  hasAssets: true,
  isLoaded: true,
}

describe("useMonteCarloSimulation seed", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: fixtureMonteCarloResult }),
    }) as jest.Mock
  })

  it("should send the seed in the request body when one is given", async () => {
    const { result } = renderHook(() =>
      useMonteCarloSimulation({ plan, assets, seed: 4213 }),
    )
    await act(async () => {
      await result.current.runSimulation(500)
    })
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.seed).toBe(4213)
    expect(body.iterations).toBe(500)
  })

  it("should omit seed from the request body when none is given", async () => {
    const { result } = renderHook(() =>
      useMonteCarloSimulation({ plan, assets }),
    )
    await act(async () => {
      await result.current.runSimulation()
    })
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body)).not.toHaveProperty("seed")
  })
})
