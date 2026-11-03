import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import MovePositionDialog from "../MovePositionDialog"
import { makePortfolio } from "@test-fixtures/portfolio"
import { makeAsset } from "@test-fixtures/asset"

const mockMoveTrns = jest.fn()
const mockMutate = jest.fn()

jest.mock("@utils/api/client/trns", () => ({
  moveTrns: (...args: unknown[]) => mockMoveTrns(...args),
}))
jest.mock("swr", () => ({
  __esModule: true,
  mutate: (...args: unknown[]) => mockMutate(...args),
  default: jest.fn(),
}))

const source = makePortfolio({ id: "p-src", code: "SRC", name: "Source" })
const target = makePortfolio({ id: "p-tgt", code: "TGT", name: "Target" })
const sourceData = {
  asset: makeAsset({ id: "a1", code: "AAPL", name: "Apple Inc." }),
  portfolioId: "p-src",
  portfolioCode: "SRC",
}

function renderDialog(
  props: Partial<React.ComponentProps<typeof MovePositionDialog>> = {},
): { onClose: jest.Mock; rerender: () => void } {
  const onClose = jest.fn()
  const all = {
    modalOpen: true,
    onClose,
    sourceData,
    portfolios: [source, target],
    ...props,
  }
  const view = render(<MovePositionDialog {...all} />)
  return {
    onClose,
    rerender: () => view.rerender(<MovePositionDialog {...all} />),
  }
}

describe("MovePositionDialog", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <MovePositionDialog
        modalOpen={false}
        onClose={jest.fn()}
        sourceData={sourceData}
        portfolios={[source, target]}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("explains when there is no other portfolio to move to", () => {
    renderDialog({ portfolios: [source] })
    expect(screen.getByText("No other portfolios available")).toBeVisible()
    expect(screen.getByRole("button", { name: "Move Position" })).toBeDisabled()
  })

  it("excludes the source portfolio from the targets", () => {
    renderDialog({ portfolios: [source, target] })
    expect(screen.getByText("AAPL")).toBeVisible()
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent("TGT - Target")
  })

  it("moves the position, refreshes both portfolios and closes after success", async () => {
    const user = userEvent.setup()
    mockMoveTrns.mockResolvedValue({ ok: true })
    const closed = jest.fn()
    render(<ClosedThenOpen sourceData={sourceData} onClose={closed} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByLabelText(/Maintain current cash balances/))
    expect(
      screen.getByText("Cash balances will be preserved in both portfolios"),
    ).toBeVisible()
    await user.click(screen.getByRole("button", { name: "Move Position" }))

    await waitFor(() =>
      expect(mockMoveTrns).toHaveBeenCalledWith({
        sourcePortfolioId: "p-src",
        targetPortfolioId: "p-tgt",
        assetId: "a1",
        maintainCashBalances: true,
      }),
    )
    await screen.findByRole("button", { name: "Success" })
    expect(mockMutate).toHaveBeenCalledTimes(3)
    await waitFor(() => expect(closed).toHaveBeenCalled(), { timeout: 2000 })
  })

  it("shows the server message when the move fails", async () => {
    const user = userEvent.setup()
    mockMoveTrns.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Cannot move" }),
    })
    render(<ClosedThenOpen sourceData={sourceData} onClose={jest.fn()} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("button", { name: "Move Position" }))
    expect(await screen.findByText("Cannot move")).toBeVisible()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it("falls back to a generic error when the failure body is unreadable", async () => {
    const user = userEvent.setup()
    mockMoveTrns.mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    })
    render(<ClosedThenOpen sourceData={sourceData} onClose={jest.fn()} />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.click(screen.getByRole("button", { name: "Move Position" }))
    expect(await screen.findByText("Failed to move position")).toBeVisible()
  })

  it("lets the user pick a different target", async () => {
    const user = userEvent.setup()
    const third = makePortfolio({ id: "p-3", code: "THR", name: "Third" })
    mockMoveTrns.mockResolvedValue({ ok: true })
    render(
      <ClosedThenOpen
        sourceData={sourceData}
        onClose={jest.fn()}
        portfolios={[source, target, third]}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Open" }))
    await user.selectOptions(screen.getByRole("combobox"), "p-3")
    await user.click(screen.getByRole("button", { name: "Move Position" }))
    await waitFor(() =>
      expect(mockMoveTrns).toHaveBeenCalledWith(
        expect.objectContaining({ targetPortfolioId: "p-3" }),
      ),
    )
  })
})

/** Opens the dialog after mount, as the app does, so the reset-on-open path runs. */
function ClosedThenOpen({
  sourceData: sd,
  onClose,
  portfolios = [source, target],
}: {
  sourceData: typeof sourceData
  onClose: () => void
  portfolios?: React.ComponentProps<typeof MovePositionDialog>["portfolios"]
}): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <MovePositionDialog
        modalOpen={open}
        onClose={onClose}
        sourceData={sd}
        portfolios={portfolios}
      />
    </>
  )
}
