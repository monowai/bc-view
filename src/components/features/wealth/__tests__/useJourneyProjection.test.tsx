import React from "react"
import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import type { IndependencePlan } from "types/independence"
import {
  makeCompositeProjection,
  makeJourney,
  makePlan,
} from "@test-fixtures/independence"
import { compositeProjectionUrl } from "@utils/api/client/independence"
import { useJourneyProjection } from "../useJourneyProjection"

const wrapper = ({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
)

const phases = [
  { planId: "plan-go", fromAge: 60, toAge: 75 },
  { planId: "plan-slow", fromAge: 75 },
]

const phased = (overrides: Partial<IndependencePlan> = {}): IndependencePlan =>
  makeJourney({
    id: "jrn-1",
    displayCurrency: "NZD",
    phases: JSON.stringify(phases),
    ...overrides,
  })

const answer = (body: unknown, ok = true): void => {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  })
}

describe("useJourneyProjection", () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockClear()
  })

  it("projects the journey's own phases in its display currency", async () => {
    const projection = makeCompositeProjection({
      displayCurrency: "NZD",
      liquidAssets: 900_000,
    })
    answer({ data: projection })

    const { result } = renderHook(
      () => useJourneyProjection(phased({ workScenarioId: "ws-1" })),
      { wrapper },
    )

    await waitFor(() => expect(result.current.projection).toEqual(projection))
    expect(result.current.isLoading).toBe(false)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(compositeProjectionUrl)
    expect(JSON.parse(init.body)).toEqual({
      displayCurrency: "NZD",
      phases,
      workScenarioId: "ws-1",
    })
  })

  it("projects in the landing plan's currency when the journey has none saved", async () => {
    answer({ data: makeCompositeProjection({ displayCurrency: "SGD" }) })

    const { result } = renderHook(
      () =>
        useJourneyProjection(
          phased({ displayCurrency: undefined }),
          makePlan({ expensesCurrency: "SGD" }),
        ),
      { wrapper },
    )

    await waitFor(() => expect(result.current.projection).not.toBeNull())
    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(JSON.parse(init.body).displayCurrency).toBe("SGD")
  })

  it("is loading until the projection lands", () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useJourneyProjection(phased()), {
      wrapper,
    })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.projection).toBeNull()
  })

  it("reports an error, and no projection, when the request fails", async () => {
    answer({ message: "boom" }, false)
    const { result } = renderHook(() => useJourneyProjection(phased()), {
      wrapper,
    })
    await waitFor(() => expect(result.current.error).toBeDefined())
    expect(result.current.projection).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("does not fetch without a journey", () => {
    const { result } = renderHook(() => useJourneyProjection(undefined), {
      wrapper,
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current).toEqual({
      projection: null,
      isLoading: false,
      error: undefined,
    })
  })

  it("does not fetch for a journey with no phases", () => {
    const { result } = renderHook(
      () => useJourneyProjection(phased({ phases: undefined })),
      { wrapper },
    )
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.projection).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
})
