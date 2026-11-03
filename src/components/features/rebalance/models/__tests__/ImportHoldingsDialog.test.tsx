import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSWR from "swr"
import ImportHoldingsDialog from "../ImportHoldingsDialog"
import { makePortfolio } from "@test-fixtures/beancounter"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const portfolio = makePortfolio({ id: "p1", code: "GROWTH" })

function mockWeights(weights: Record<string, unknown>[]): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: weights }),
  }) as unknown as typeof fetch
}

const weight = (assetCode: string, value: number): Record<string, unknown> => ({
  assetId: `id-${assetCode}`,
  assetCode,
  assetName: `${assetCode} name`,
  marketCode: "NYSE",
  weight: value,
  marketValue: 1000,
  price: 10,
  priceCurrency: "USD",
})

describe("ImportHoldingsDialog", () => {
  const onImport = jest.fn()
  const onClose = jest.fn()

  beforeEach(() => {
    ;(useSWR as unknown as jest.Mock).mockReturnValue({
      data: { data: [portfolio] },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  async function selectPortfolio(): Promise<void> {
    render(
      <ImportHoldingsDialog
        modalOpen={true}
        modelId="m1"
        onClose={onClose}
        onImport={onImport}
      />,
    )
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "p1" } })
    await waitFor(() =>
      expect(screen.getByText("Target Allocations")).toBeInTheDocument(),
    )
  }

  it("prompts for a portfolio before showing allocations", () => {
    render(
      <ImportHoldingsDialog
        modalOpen={true}
        modelId="m1"
        onClose={onClose}
        onImport={onImport}
      />,
    )
    expect(
      screen.getByText("Select a portfolio to view its holdings"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Target Allocations")).not.toBeInTheDocument()
  })

  it("lists each holding with its current and target weight", async () => {
    mockWeights([weight("AAA", 0.6), weight("BBB", 0.4)])
    await selectPortfolio()

    expect(screen.getByText("AAA")).toBeInTheDocument()
    expect(screen.getByText("AAA name")).toBeInTheDocument()
    expect(screen.getByText("60.0%")).toBeInTheDocument()
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(60)
    expect(screen.getByText("2 assets")).toBeInTheDocument()
  })

  it("says so when the portfolio has no eligible assets", async () => {
    mockWeights([])
    await selectPortfolio()

    expect(
      screen.getByText("No eligible assets found in holdings"),
    ).toBeInTheDocument()
  })

  it("clamps an edited weight and imports it", async () => {
    mockWeights([weight("AAA", 0.6), weight("BBB", 0.4)])
    await selectPortfolio()

    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "250" },
    })
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(100)

    fireEvent.click(screen.getByRole("button", { name: "Import" }))

    expect(onImport.mock.calls[0][0][0]).toMatchObject({
      assetCode: "AAA",
      weight: 100,
    })
    expect(onClose).toHaveBeenCalled()
  })

  it("offers to normalize weights that miss 100%, and scales them", async () => {
    mockWeights([weight("AAA", 0.6), weight("BBB", 0.2)])
    await selectPortfolio()

    fireEvent.click(screen.getByRole("button", { name: "Normalize to 100%" }))

    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(75)
    expect(
      screen.queryByRole("button", { name: "Normalize to 100%" }),
    ).not.toBeInTheDocument()
  })

  it("keeps the allocations header's bottom margin", async () => {
    mockWeights([weight("AAA", 1)])
    await selectPortfolio()

    expect(screen.getByText("Target Allocations").parentElement).toHaveClass(
      "flex items-center justify-between mb-2",
      { exact: true },
    )
  })
})
