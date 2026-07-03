import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import SetAccountBalancesDialog from "../SetAccountBalancesDialog"
import { Asset, Portfolio } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { data: [] },
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  })),
  mutate: jest.fn(),
  SWRConfig: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock("@components/ui/DropZone", () => ({
  postData: jest.fn(),
}))

const portfolio = {
  id: "p1",
  code: "SGD",
  name: "SGD Portfolio",
} as Portfolio

const asset = {
  id: "choc-1",
  code: "CHOC",
  name: "Chocolate Finance Balance",
  assetCategory: { id: "ACCOUNT", name: "Bank Account" },
  market: { code: "PRIVATE" },
} as unknown as Asset

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        data: [{ portfolio, position: null, balance: 38797 }],
      }),
  }) as unknown as typeof fetch
})

describe("SetAccountBalancesDialog", () => {
  it("renders a large per-portfolio Target input with Current Balance shown below it", async () => {
    render(
      <SetAccountBalancesDialog
        asset={asset}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    )

    const input = await screen.findByLabelText(/Target.*SGD Portfolio/i)
    expect(input.className).toContain("text-lg")
    expect(input.className).toContain("py-3")

    // Not a 4-column table with a separate "Current" header — stacked layout instead
    expect(
      screen.queryByRole("columnheader", { name: /current/i }),
    ).not.toBeInTheDocument()

    const currentBalanceLabel = screen.getByText(/Current Balance/i)
    expect(
      input.compareDocumentPosition(currentBalanceLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
