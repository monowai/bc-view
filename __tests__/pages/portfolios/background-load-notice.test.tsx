import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import Portfolios from "@pages/portfolios"
import useSWR from "swr"
import { portfolioResult, mockUserProfile } from "../../fixtures"

jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})
jest.mock("remark-gfm", () => () => {})

jest.mock("swr", () => ({ __esModule: true, default: jest.fn() }))

/** Stands in for the dialog: its Load in Background hands a result up and closes. */
jest.mock(
  "@components/features/portfolios/PortfolioCorporateActionsPopup",
  () =>
    function MockPopup({
      onClose,
      onBackgroundLoad,
    }: {
      onClose: () => void
      onBackgroundLoad?: (outcome: unknown) => void
    }) {
      return (
        <button
          type="button"
          onClick={() => {
            onBackgroundLoad?.({
              status: "STARTED",
              portfolioId: "P123",
              asAt: "2019-01-01",
            })
            onClose()
          }}
        >
          Load in Background
        </button>
      )
    },
)

// Cast to any since withPageAuthRequired HOC strips prop types in v4
const PortfoliosPage = Portfolios as React.ComponentType<any>

describe("Portfolios page background load notice", () => {
  beforeEach(() => {
    global.fetch = jest.fn((url: string) =>
      Promise.resolve({
        json: () =>
          Promise.resolve(
            url === "/api/currencies"
              ? { data: [{ code: "USD", name: "Dollar", symbol: "$" }] }
              : { data: {} },
          ),
      }),
    ) as unknown as typeof fetch
    ;(useSWR as jest.Mock).mockReturnValue({
      data: portfolioResult,
      error: null,
      mutate: jest.fn(),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("shows what happens next above the list once the dialog starts a background load", async () => {
    render(<PortfoliosPage user={mockUserProfile} />)
    const scan = await waitFor(
      () => screen.getAllByLabelText("Scan corporate actions for P123")[0],
    )

    fireEvent.click(scan)
    fireEvent.click(screen.getByRole("button", { name: "Load in Background" }))

    expect(
      await screen.findByText(
        /Loading dividends and splits since 2019-01-01 in the background\./,
      ),
    ).toHaveTextContent(
      "Loading dividends and splits since 2019-01-01 in the background. Past ones are recorded as they arrive; any not yet paid wait in Proposed Transactions for you to confirm.",
    )
    expect(
      screen.getByRole("link", { name: "Proposed Transactions" }),
    ).toHaveAttribute("href", "/trns/proposed")
    expect(
      screen.queryByRole("button", { name: "Load in Background" }),
    ).not.toBeInTheDocument()
  })
})
