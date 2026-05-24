import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ScenarioContributions from "../ScenarioContributions"

// SWR is mocked per-key so we can simulate the asset-configs + contributions
// fetches independently. Without per-key control, the same data goes to both
// hooks and the contribution-seed effect overwrites our edits.
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => {
    if (key === "/api/assets/config") {
      return {
        data: {
          data: [
            {
              assetId: "cpf-1",
              isPension: true,
              contributionFrequency: "ANNUAL",
              policyType: "CPF",
            },
            {
              assetId: "kiwi-1",
              isPension: true,
              contributionFrequency: "MONTHLY",
            },
            { assetId: "re-1", isPension: false }, // filtered out
          ],
          assetNames: {
            "cpf-1": "My CPF",
            "kiwi-1": "Kiwi Saver",
            "re-1": "House",
          },
        },
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      }
    }
    return {
      data: { data: [] },
      error: undefined,
      isLoading: false,
      mutate: jest.fn(),
    }
  },
}))

describe("ScenarioContributions", () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
    ) as jest.Mock
  })

  afterEach(() => jest.restoreAllMocks())

  it("lists only pension assets", () => {
    render(<ScenarioContributions scenarioId="s1" currency="SGD" />)
    expect(screen.getByText("My CPF")).toBeInTheDocument()
    expect(screen.getByText("Kiwi Saver")).toBeInTheDocument()
    expect(screen.queryByText("House")).not.toBeInTheDocument()
  })

  it("renders ANNUAL / MONTHLY frequency labels from asset config", () => {
    render(<ScenarioContributions scenarioId="s1" currency="SGD" />)
    expect(screen.getByText(/SGD per year/i)).toBeInTheDocument()
    expect(screen.getByText(/SGD per month/i)).toBeInTheDocument()
  })

  it("posts to the scenario contributions endpoint on blur", async () => {
    render(<ScenarioContributions scenarioId="s1" currency="SGD" />)

    const input = screen.getByLabelText("Contribution for My CPF")
    fireEvent.change(input, { target: { value: "8000" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/independence/work-scenarios/s1/contributions",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"monthlyAmount":8000'),
        }),
      )
    })
  })
})
