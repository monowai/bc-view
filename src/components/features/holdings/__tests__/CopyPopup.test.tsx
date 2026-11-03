import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import CopyPopup from "../CopyPopup"
import { makePosition } from "@test-fixtures/beancounter"
import { makeAsset } from "@test-fixtures/asset"
import type { ValueInOption } from "types/constants"

const valueIn = "PORTFOLIO" as ValueInOption
const columns = [
  "Asset Code",
  "Asset Name",
  "Quantity",
  "Market Value",
  "Bogus",
]

function data(): React.ComponentProps<typeof CopyPopup>["data"] {
  return {
    held: makePosition({
      asset: makeAsset({ code: "AAPL", name: "Apple Inc." }),
      quantityValues: { total: 10 },
      moneyValues: { marketValue: 1500 },
    }),
    sold: makePosition({
      asset: makeAsset({ code: "MSFT", name: "Microsoft" }),
      quantityValues: { total: 0 },
    }),
  }
}

describe("CopyPopup", () => {
  const writeText = jest.fn()
  // userEvent.setup() installs its own clipboard stub, so call this after it.
  const setClipboard = (clipboard: unknown): void => {
    Object.defineProperty(navigator, "clipboard", {
      value: clipboard,
      configurable: true,
    })
  }
  beforeEach(() => {
    jest.clearAllMocks()
    writeText.mockResolvedValue(undefined)
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <CopyPopup
        columns={columns}
        data={data()}
        valueIn={valueIn}
        modalOpen={false}
        onClose={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("copies the selected columns as tab-separated rows, skipping closed positions, then closes", async () => {
    const user = userEvent.setup()
    setClipboard({ writeText })
    const onClose = jest.fn()
    render(
      <CopyPopup
        columns={columns}
        data={data()}
        valueIn={valueIn}
        modalOpen
        onClose={onClose}
      />,
    )
    await user.click(screen.getByLabelText("Asset Code"))
    await user.click(screen.getByLabelText("Quantity"))
    await user.click(screen.getByLabelText("Market Value"))
    await user.click(screen.getByLabelText("Bogus"))
    // toggling off removes it again
    await user.click(screen.getByLabelText("Bogus"))
    await user.click(screen.getByRole("button", { name: "Copy" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(writeText).toHaveBeenCalledWith(
      "Asset Code\tQuantity\tMarket Value\nAAPL\t10\t1500",
    )
  })

  it("keeps the dialog open and logs when the clipboard write fails", async () => {
    const user = userEvent.setup()
    setClipboard({ writeText })
    const err = jest.spyOn(console, "error").mockImplementation(() => {})
    writeText.mockRejectedValue(new Error("denied"))
    const onClose = jest.fn()
    render(
      <CopyPopup
        columns={columns}
        data={data()}
        valueIn={valueIn}
        modalOpen
        onClose={onClose}
      />,
    )
    await user.click(screen.getByLabelText("Asset Name"))
    await user.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => expect(err).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it("falls back to execCommand when the clipboard API is unavailable", async () => {
    const user = userEvent.setup()
    setClipboard({ writeText })
    setClipboard(undefined)
    const exec = jest.fn().mockReturnValue(true)
    document.execCommand = exec
    const onClose = jest.fn()
    render(
      <CopyPopup
        columns={columns}
        data={data()}
        valueIn={valueIn}
        modalOpen
        onClose={onClose}
      />,
    )
    await user.click(screen.getByLabelText("Asset Name"))
    await user.click(screen.getByRole("button", { name: "Copy" }))
    expect(exec).toHaveBeenCalledWith("copy")
    expect(onClose).toHaveBeenCalled()
  })

  it("logs and stays open when the fallback copy throws", async () => {
    const user = userEvent.setup()
    setClipboard({ writeText })
    const err = jest.spyOn(console, "error").mockImplementation(() => {})
    setClipboard(undefined)
    document.execCommand = jest.fn(() => {
      throw new Error("nope")
    })
    const onClose = jest.fn()
    render(
      <CopyPopup
        columns={columns}
        data={data()}
        valueIn={valueIn}
        modalOpen
        onClose={onClose}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Copy" }))
    expect(err).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    err.mockRestore()
  })

  it("emits a value for every supported column", async () => {
    const user = userEvent.setup()
    setClipboard({ writeText })
    const all = [
      "Classification",
      "Price",
      "Change %",
      "Change on Day",
      "Cost Value",
      "Unrealised Gain",
      "Realised Gain",
      "Dividends",
      "IRR",
      "Weight",
      "Total Gain",
    ]
    render(
      <CopyPopup
        columns={all}
        data={data()}
        valueIn={valueIn}
        modalOpen
        onClose={jest.fn()}
      />,
    )
    for (const c of all) await user.click(screen.getByLabelText(c))
    await user.click(screen.getByRole("button", { name: "Copy" }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const [header, row] = writeText.mock.calls[0][0].split("\n")
    expect(header.split("\t")).toEqual(all)
    expect(row.split("\t")).toHaveLength(all.length)
    expect(row).toContain("Equity")
  })
})
