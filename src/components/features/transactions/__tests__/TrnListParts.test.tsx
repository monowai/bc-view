import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { TrnDetailTabs, TrnNumber, TrnStatusBadge } from "../TrnListParts"

describe("TrnDetailTabs", () => {
  const renderTabs = (
    signals: React.ComponentProps<typeof TrnDetailTabs>["signals"],
  ): void => {
    render(
      <TrnDetailTabs
        active="trades"
        portfolioId="p1"
        assetId="a1"
        signals={signals}
      />,
    )
  }

  it("marks the active tab as selected", () => {
    renderTabs({})
    expect(screen.getByRole("tab", { name: /Trades/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByRole("tab", { name: /Events/ })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  it("shows how many rows each tab holds", () => {
    renderTabs({
      trades: { count: 10, proposed: 0 },
      events: { count: 46, proposed: 0 },
    })
    expect(screen.getByRole("tab", { name: /Trades.*10/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Events.*46/ })).toBeInTheDocument()
  })

  it("says when a tab is empty", () => {
    renderTabs({ events: { count: 0, proposed: 0 } })
    expect(
      screen.getByRole("tab", { name: /Events.*none/ }),
    ).toBeInTheDocument()
  })

  it("flags rows still proposed", () => {
    renderTabs({ events: { count: 46, proposed: 1 } })
    expect(screen.getByTitle("1 proposed")).toBeInTheDocument()
  })

  it("shows no count while a list loads", () => {
    renderTabs({})
    expect(screen.getByRole("tab", { name: "Trades" })).toBeInTheDocument()
  })
})

describe("TrnNumber", () => {
  it("formats figures with separators", () => {
    render(<TrnNumber value={2801.5} scale={2} />)
    expect(screen.getByText("2,801.50")).toBeInTheDocument()
  })

  it("quietens zero so the figures that matter stand out", () => {
    render(<TrnNumber value={0} scale={2} blankZero />)
    expect(screen.getByLabelText("zero")).toHaveTextContent("–")
  })

  it("keeps zero by default", () => {
    render(<TrnNumber value={0} scale={2} />)
    expect(screen.getByText("0.00")).toBeInTheDocument()
  })
})

describe("TrnStatusBadge", () => {
  it("keeps settled quiet and calls out proposed", () => {
    render(
      <>
        <TrnStatusBadge status="SETTLED" />
        <TrnStatusBadge status="PROPOSED" />
      </>,
    )
    expect(screen.getByText("Settled")).toBeInTheDocument()
    expect(screen.getByText("Proposed")).toBeInTheDocument()
  })
})
