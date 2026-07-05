import React from "react"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import "@testing-library/jest-dom"
import SetAccountBalancesDialog from "@components/features/accounts/SetAccountBalancesDialog"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isLoading: false })),
}))

const mockAsset = {
  id: "acct-1",
  code: "OWNER:SAVINGS",
  name: "Savings Account",
  market: { code: "PRIVATE", currency: { code: "USD" } },
  accountingType: null,
}

const mockPortfolio = {
  id: "pf-1",
  code: "MYPORT",
  name: "My Portfolio",
  currency: { code: "USD" },
}

const positionsResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      data: [{ portfolio: mockPortfolio, position: null, balance: 5000 }],
    }),
}

describe("SetAccountBalancesDialog", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    global.fetch = jest
      .fn()
      .mockResolvedValue(positionsResponse) as unknown as typeof fetch
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders the dialog title and asset info", async () => {
    render(
      <SetAccountBalancesDialog
        asset={mockAsset as any}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    )
    expect(screen.getByText("Set Account Balances")).toBeInTheDocument()
    await waitFor(() => screen.getByText("My Portfolio"))
  })

  it("disables Proceed while submitting", async () => {
    // First call resolves positions; subsequent calls hang (simulate in-flight submit)
    let resolveSubmit!: (v: any) => void
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(positionsResponse)
      .mockImplementationOnce(
        () =>
          new Promise((res) => {
            resolveSubmit = res
          }),
      )

    render(
      <SetAccountBalancesDialog
        asset={mockAsset as any}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    )

    await waitFor(() => screen.getByText("My Portfolio"))

    // Trigger a balance change so changesCount > 0
    const input = screen.getByLabelText("Target balance for My Portfolio")
    fireEvent.change(input, { target: { value: "6000" } })

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /proceed/i }),
      ).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole("button", { name: /proceed/i }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /applying changes/i }),
      ).toBeDisabled(),
    )

    // Resolve the in-flight call so the component settles before cleanup
    act(() => {
      resolveSubmit({ ok: true, json: () => Promise.resolve({}) })
    })
  })

  it("shows an error when the submit API rejects", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(positionsResponse)
      .mockRejectedValueOnce(new Error("Balance update failed"))

    render(
      <SetAccountBalancesDialog
        asset={mockAsset as any}
        onClose={jest.fn()}
        onComplete={jest.fn()}
      />,
    )

    await waitFor(() => screen.getByText("My Portfolio"))

    const input = screen.getByLabelText("Target balance for My Portfolio")
    fireEvent.change(input, { target: { value: "6000" } })

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /proceed/i }),
      ).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole("button", { name: /proceed/i }))

    await waitFor(() =>
      expect(screen.getByText("Balance update failed")).toBeInTheDocument(),
    )
  })

  it("calls onComplete after successful submit (with delay)", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(positionsResponse)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

    const onComplete = jest.fn()
    render(
      <SetAccountBalancesDialog
        asset={mockAsset as any}
        onClose={jest.fn()}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => screen.getByText("My Portfolio"))

    const input = screen.getByLabelText("Target balance for My Portfolio")
    fireEvent.change(input, { target: { value: "6000" } })

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /proceed/i }),
      ).not.toBeDisabled(),
    )

    fireEvent.click(screen.getByRole("button", { name: /proceed/i }))

    // onComplete called after the auto-close delay
    await waitFor(() => expect(onComplete).not.toHaveBeenCalled())
    act(() => {
      jest.advanceTimersByTime(1500)
    })
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})
