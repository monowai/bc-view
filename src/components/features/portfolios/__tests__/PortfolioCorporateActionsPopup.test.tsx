import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
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

function mockFetch(events: Record<string, unknown>[]): void {
  global.fetch = jest.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: url.includes("corporate-events") ? events : [],
        }),
    }),
  ) as unknown as typeof fetch
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
})
