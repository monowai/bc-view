import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react"
import TrnDropZone from "@components/ui/DropZone"
import { makePortfolio } from "@test-fixtures/beancounter"

// Guards the react-dropzone wiring: the hook must still render an <input
// type="file"> under root props and hand dropped files to onDrop. Both are
// the parts a react-dropzone major can silently change.

const CSV = ["symbol,quantity", "# a comment row", "MSFT,10"].join("\n")

function dropFile(input: Element, contents: string): void {
  const file = new File([contents], "trades.csv", { type: "text/csv" })
  fireEvent.change(input, { target: { files: [file] } })
}

describe("TrnDropZone", () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockClear()
  })

  it("renders a file input and the upload icon", () => {
    const { container } = render(
      <TrnDropZone portfolio={makePortfolio()} purge={false} />,
    )
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument()
    expect(container.querySelector("i")).toHaveClass("fa-circle-up")
  })

  it("hides the icon when asked", () => {
    const { container } = render(
      <TrnDropZone portfolio={makePortfolio()} purge={false} hideIcon />,
    )
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument()
    expect(container.querySelector("i")).not.toBeInTheDocument()
  })

  it("renders nothing to drop on for an unsaved portfolio", () => {
    const { container } = render(
      <TrnDropZone portfolio={makePortfolio({ id: "new" })} purge={false} />,
    )
    expect(
      container.querySelector('input[type="file"]'),
    ).not.toBeInTheDocument()
  })

  it("posts data rows, skipping the header and comment rows", async () => {
    const portfolio = makePortfolio()
    const { container } = render(
      <TrnDropZone portfolio={portfolio} purge={false} />,
    )

    dropFile(container.querySelector('input[type="file"]') as Element, CSV)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe("/api/trns/import")
    expect(JSON.parse(init.body)).toEqual({
      hasHeader: true,
      portfolio,
      purge: false,
      row: ["MSFT", "10"],
    })
  })
})
