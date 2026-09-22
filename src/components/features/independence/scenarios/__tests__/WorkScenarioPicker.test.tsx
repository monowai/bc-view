import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import WorkScenarioPicker from "../WorkScenarioPicker"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const mockCtx = {
  compositeWorkScenarioId: "s1" as string | undefined,
  setCompositeWorkScenarioId: jest.fn(),
  refreshProjection: jest.fn(),
}
jest.mock("../../composite/CompositeProjectionContext", () => ({
  useCompositeProjectionContext: () => mockCtx,
}))

const swr = (value: Record<string, unknown>): void => {
  ;(useSwr as unknown as jest.Mock).mockReturnValue({
    data: undefined,
    error: undefined,
    isLoading: false,
    ...value,
  })
}

const scenarios = {
  data: [
    { id: "s1", name: "Working - SGD", isCurrent: true },
    { id: "s2", name: "Part time", isCurrent: false },
  ],
}

describe("WorkScenarioPicker", () => {
  beforeEach(() => jest.clearAllMocks())

  it("lists the scenarios and shows the one the plan runs on", () => {
    swr({ data: scenarios })
    render(<WorkScenarioPicker />)
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("s1")
  })

  it("does not vanish while the request is in flight", () => {
    // Returning null here hid the only control that decides which scenario the
    // projection runs on, and a dropped request looked exactly like "you have
    // no scenarios".
    swr({ isLoading: true })
    render(<WorkScenarioPicker />)
    expect(screen.getByText(/Loading your scenarios/i)).toBeInTheDocument()
  })

  it("says so when the scenarios could not be loaded", () => {
    swr({ error: new Error("boom") })
    render(<WorkScenarioPicker />)
    expect(
      screen.getByText(/Couldn't load your scenarios/i),
    ).toBeInTheDocument()
  })

  it("stays hidden when the account genuinely has none", () => {
    swr({ data: { data: [] } })
    const { container } = render(<WorkScenarioPicker />)
    expect(container).toBeEmptyDOMElement()
  })

  it("falls back to 'whichever is current' when the named scenario is gone", () => {
    mockCtx.compositeWorkScenarioId = "deleted-id"
    swr({ data: scenarios })
    render(<WorkScenarioPicker />)
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("")
    mockCtx.compositeWorkScenarioId = "s1"
  })
})
