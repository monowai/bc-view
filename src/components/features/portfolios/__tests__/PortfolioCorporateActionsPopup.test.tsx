import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import PortfolioCorporateActionsPopup from "../PortfolioCorporateActionsPopup"
import { makeAsset, makePortfolio } from "@test-fixtures/beancounter"

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

const asset = makeAsset({ id: "a1", code: "AAA" })

const event = (id: string, trnType: string): Record<string, unknown> => ({
  id,
  trnType,
  source: "ALPHA",
  assetId: "a1",
  recordDate: "2020-01-15",
  rate: 0.25,
  split: 1,
  payDate: "2020-02-01",
})

function mockFetch(
  events: Record<string, unknown>[],
  background: { ok: boolean; body: unknown; status?: number } = {
    ok: true,
    body: { status: "STARTED", portfolioId: "p1", asAt: "2018-06-30" },
  },
): void {
  global.fetch = jest.fn().mockImplementation((url: string) =>
    Promise.resolve(
      url.includes("/background?")
        ? {
            ok: background.ok,
            status: background.status ?? (background.ok ? 202 : 500),
            json: () => Promise.resolve(background.body),
            text: () => Promise.resolve(JSON.stringify(background.body)),
          }
        : {
            ok: true,
            json: () =>
              Promise.resolve({
                data: url.includes("corporate-events") ? events : [],
              }),
          },
    ),
  ) as unknown as typeof fetch
}

const cash = makeAsset({ id: "cash", code: "USD" })

/** Two holdings and a cash balance opened earlier than either; cash is never loaded. */
function holdings(): void {
  ;(useSwr as unknown as jest.Mock).mockReturnValue({
    data: {
      data: {
        positions: {
          a1: { asset, dateValues: { opened: "2019-01-01" } },
          a2: {
            asset: makeAsset({ id: "a2", code: "BBB" }),
            dateValues: { opened: "2018-06-30" },
          },
          cash: {
            asset: { ...cash, cashLike: true },
            dateValues: { opened: "2010-01-01" },
          },
        },
      },
    },
  })
}

describe("PortfolioCorporateActionsPopup", () => {
  beforeEach(() => {
    ;(useSwr as unknown as jest.Mock).mockReturnValue({
      data: {
        data: {
          positions: {
            a1: { asset, dateValues: { opened: "2019-01-01" } },
          },
        },
      },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing while closed", () => {
    const { container } = render(
      <PortfolioCorporateActionsPopup
        portfolio={makePortfolio()}
        modalOpen={false}
        onClose={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ["DIVI", "Dividend", "fa-money-bill-wave"],
    ["SPLIT", "Split", "fa-code-branch"],
    ["OTHER", "OTHER", "fa-calendar"],
  ])("names a %s event and gives it its icon", async (type, label, icon) => {
    mockFetch([event("e1", type)])
    render(
      <PortfolioCorporateActionsPopup
        portfolio={makePortfolio()}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Scan Corporate Actions" }),
    )

    const cell = await screen.findByText(label)
    expect(cell.querySelector("i")).toHaveClass(icon)
  })

  it("Load in Background starts the load from the earliest non-cash holding, closes and hands the result up", async () => {
    holdings()
    mockFetch([])
    const onClose = jest.fn()
    const onBackgroundLoad = jest.fn()
    render(
      <PortfolioCorporateActionsPopup
        portfolio={makePortfolio({ id: "p1" })}
        modalOpen={true}
        onClose={onClose}
        onBackgroundLoad={onBackgroundLoad}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Load in Background" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/corporate-events/load/p1/background?asAt=2018-06-30",
      { method: "POST" },
    )
    expect(onBackgroundLoad).toHaveBeenCalledWith({
      status: "STARTED",
      portfolioId: "p1",
      asAt: "2018-06-30",
    })
  })

  it("a background load that cannot start shows the server's message and stays open", async () => {
    holdings()
    mockFetch([], {
      ok: false,
      status: 403,
      body: { message: "Portfolio p1 is not yours" },
    })
    const onClose = jest.fn()
    const onBackgroundLoad = jest.fn()
    render(
      <PortfolioCorporateActionsPopup
        portfolio={makePortfolio({ id: "p1" })}
        modalOpen={true}
        onClose={onClose}
        onBackgroundLoad={onBackgroundLoad}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Load in Background" }))

    expect(
      await screen.findByText("Portfolio p1 is not yours"),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onBackgroundLoad).not.toHaveBeenCalled()
  })

  it("after a Backfill, says past events are recorded and the rest wait in Proposed Transactions", async () => {
    mockFetch([event("e1", "DIVI")])
    render(
      <PortfolioCorporateActionsPopup
        portfolio={makePortfolio()}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Scan Corporate Actions" }),
    )
    await screen.findByText("Dividend")
    expect(
      screen.queryByRole("link", { name: "Proposed Transactions" }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Backfill/ }))

    expect(
      await screen.findByText(/Past dividends and splits are recorded/),
    ).toHaveTextContent(
      "Past dividends and splits are recorded; any not yet paid wait in Proposed Transactions.",
    )
    expect(
      screen.getByRole("link", { name: "Proposed Transactions" }),
    ).toHaveAttribute("href", "/trns/proposed")
  })
})
