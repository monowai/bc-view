import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import ConsolidatePortfoliosDialog from "../ConsolidatePortfoliosDialog"
import { makePortfolio } from "@test-fixtures/beancounter"

const portfolios = [
  makePortfolio({ id: "pf-1", code: "MAIN", name: "Main" }),
  makePortfolio({ id: "pf-2", code: "SIDE", name: "Side" }),
]

function renderDialog(
  overrides: Partial<{
    onClose: () => void
    onComplete: () => void | Promise<void>
  }> = {},
): { onClose: jest.Mock; onComplete: jest.Mock } {
  const onClose = jest.fn()
  const onComplete = jest.fn()
  render(
    <ConsolidatePortfoliosDialog
      portfolios={portfolios}
      onClose={overrides.onClose ?? onClose}
      onComplete={overrides.onComplete ?? onComplete}
    />,
  )
  return { onClose, onComplete }
}

describe("ConsolidatePortfoliosDialog", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { sourceDeleted: true } }),
    }) as unknown as typeof fetch
  })

  const selectSource = (id: string): void => {
    fireEvent.change(screen.getByLabelText("Move everything from"), {
      target: { value: id },
    })
  }
  const selectTarget = (id: string): void => {
    fireEvent.change(screen.getByLabelText("Into"), {
      target: { value: id },
    })
  }

  it("disables Review until a distinct source and target are chosen", () => {
    renderDialog()
    const review = screen.getByRole("button", { name: "Review" })
    expect(review).toBeDisabled()
    selectSource("pf-1")
    expect(review).toBeDisabled()
    selectTarget("pf-2")
    expect(review).toBeEnabled()
  })

  it("excludes the chosen source from the target options", () => {
    renderDialog()
    selectSource("pf-1")
    const targetOptions = Array.from(
      (screen.getByLabelText("Into") as HTMLSelectElement).options,
    ).map((o) => o.value)
    expect(targetOptions).not.toContain("pf-1")
    expect(targetOptions).toContain("pf-2")
  })

  it("shows a confirmation naming source and target before merging", () => {
    renderDialog()
    selectSource("pf-1")
    selectTarget("pf-2")
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    const confirm = screen.getByText(/will be permanently deleted/)
    expect(confirm).toBeInTheDocument()
    // Source MAIN moves into target SIDE.
    expect(screen.getAllByText("MAIN").length).toBeGreaterThan(0)
    expect(screen.getByText("SIDE")).toBeInTheDocument()
  })

  it("POSTs the merge to source→target then completes", async () => {
    const { onComplete } = renderDialog()
    selectSource("pf-1")
    selectTarget("pf-2")
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    fireEvent.click(screen.getByRole("button", { name: "Consolidate" }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/portfolios/pf-1/merge/pf-2",
        expect.objectContaining({ method: "POST" }),
      )
    })
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })

  it("surfaces a server error and does not complete", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: "Conflict",
      json: () => Promise.resolve({ message: "Cannot merge" }),
    }) as unknown as typeof fetch
    const { onComplete } = renderDialog()
    selectSource("pf-1")
    selectTarget("pf-2")
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    fireEvent.click(screen.getByRole("button", { name: "Consolidate" }))

    expect(await screen.findByText("Cannot merge")).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("clears a stale error when going Back to re-select", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: "Conflict",
      json: () => Promise.resolve({ message: "Cannot merge" }),
    }) as unknown as typeof fetch
    renderDialog()
    selectSource("pf-1")
    selectTarget("pf-2")
    fireEvent.click(screen.getByRole("button", { name: "Review" }))
    fireEvent.click(screen.getByRole("button", { name: "Consolidate" }))
    expect(await screen.findByText("Cannot merge")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(screen.queryByText("Cannot merge")).not.toBeInTheDocument()
  })
})
