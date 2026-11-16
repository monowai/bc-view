import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import BrokersPage from "@pages/brokers/index"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import { enableFetchMocks } from "jest-fetch-mock"
import type { BrokerWithAccounts, GlobalBroker } from "types/beancounter"

enableFetchMocks()

jest.mock("@hooks/useBrokers")
const mockUseBrokers = useBrokers as jest.Mock

jest.mock("@hooks/useGlobalBrokers")
const mockUseGlobalBrokers = useGlobalBrokers as jest.Mock

jest.mock("next/router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}))

const firms: GlobalBroker[] = [
  { id: "gb-ibkr", code: "IBKR", name: "Interactive Brokers" },
  { id: "gb-schwab", code: "SCHWAB", name: "Charles Schwab" },
]

const linked: BrokerWithAccounts = {
  id: "b1",
  name: "My IB",
  accountNumber: "U123",
  notes: "",
  globalBrokerId: "gb-ibkr",
  settlementAccounts: [],
}

const unlinked: BrokerWithAccounts = {
  id: "b2",
  name: "Local bank",
  settlementAccounts: [],
}

describe("Brokers page: brokerage firm", () => {
  const saveBroker = jest.fn()
  const deleteBroker = jest.fn()

  // What the broker holds, as /api/trns/broker/{id}/holdings reports it.
  function holds(...quantities: number[]): void {
    fetchMock.mockResponse(
      JSON.stringify({
        brokerId: "b",
        brokerName: "b",
        holdings: quantities.map((quantity) => ({ quantity })),
      }),
    )
  }

  function show(
    brokers: BrokerWithAccounts[],
    globalBrokers: GlobalBroker[] = firms,
  ): void {
    mockUseBrokers.mockReturnValue({
      brokers,
      accountAssets: [],
      error: undefined,
      isLoading: false,
      saveBroker,
      deleteBroker,
      transferTransactions: jest.fn(),
    })
    mockUseGlobalBrokers.mockReturnValue({ globalBrokers })
    render(<BrokersPage />)
  }

  beforeEach(() => {
    saveBroker.mockReset().mockResolvedValue(undefined)
    deleteBroker.mockReset().mockResolvedValue(undefined)
    fetchMock.resetMocks()
    holds()
  })

  it("saves a new broker against the firm the user picks", async () => {
    show([])
    fireEvent.click(screen.getAllByRole("button", { name: /Add Broker/ })[0])
    fireEvent.change(screen.getByPlaceholderText("e.g., Interactive Brokers"), {
      target: { value: "My IB" },
    })
    fireEvent.change(screen.getByLabelText("Brokerage firm"), {
      target: { value: "gb-ibkr" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(saveBroker).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ name: "My IB", globalBrokerId: "gb-ibkr" }),
      ),
    )
  })

  it("saves a new broker with no firm when the user picks none", async () => {
    show([])
    fireEvent.click(screen.getAllByRole("button", { name: /Add Broker/ })[0])
    fireEvent.change(screen.getByPlaceholderText("e.g., Interactive Brokers"), {
      target: { value: "Local bank" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(saveBroker).toHaveBeenCalled())
    expect(saveBroker.mock.calls[0][1].globalBrokerId).toBeUndefined()
  })

  it("shows the firm a broker is already saved against, and lets the user change it", async () => {
    show([linked])
    fireEvent.click(screen.getByTitle("Edit"))

    const firm = screen.getByLabelText("Brokerage firm") as HTMLSelectElement
    expect(firm.value).toBe("gb-ibkr")

    fireEvent.change(firm, { target: { value: "gb-schwab" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(saveBroker).toHaveBeenCalledWith(
        "b1",
        expect.objectContaining({ globalBrokerId: "gb-schwab" }),
      ),
    )
  })

  it("offers no empty choice for a broker that already has a firm", () => {
    show([linked])
    fireEvent.click(screen.getByTitle("Edit"))

    const choices = Array.from(
      (screen.getByLabelText("Brokerage firm") as HTMLSelectElement).options,
    ).map((option) => option.value)
    expect(choices).toEqual(["gb-ibkr", "gb-schwab"])
  })

  it("shows a saved firm the list no longer names as not listed, and keeps it on save", async () => {
    show([{ ...linked, globalBrokerId: "gb-gone" }])
    fireEvent.click(screen.getByTitle("Edit"))

    const firm = screen.getByLabelText("Brokerage firm") as HTMLSelectElement
    expect(firm.selectedOptions[0].text).toBe("Not listed")

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(saveBroker).toHaveBeenCalledWith(
        "b1",
        expect.objectContaining({ globalBrokerId: "gb-gone" }),
      ),
    )
  })

  it("names the firm on the broker's card", () => {
    show([linked, unlinked])

    expect(screen.getByText("Interactive Brokers")).toBeInTheDocument()
    expect(screen.queryByText("Charles Schwab")).not.toBeInTheDocument()
  })

  it("hides the firm choice when no firms are available", () => {
    show([], [])
    fireEvent.click(screen.getAllByRole("button", { name: /Add Broker/ })[0])

    expect(screen.queryByLabelText("Brokerage firm")).not.toBeInTheDocument()
  })

  it("offers to close an account with a firm, and to delete a broker with none", () => {
    show([linked, unlinked])

    expect(screen.getAllByTitle("Close account")).toHaveLength(1)
    expect(screen.getAllByTitle("Delete")).toHaveLength(1)
  })

  it("closes an account that holds nothing, and says the firm stays", async () => {
    show([linked])
    fireEvent.click(screen.getByTitle("Close account"))

    expect(
      await screen.findByText(
        'Close your Interactive Brokers account "My IB"? Your account details are removed. Interactive Brokers stays available to add again.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByText("Close account", { selector: "button" }))

    await waitFor(() => expect(deleteBroker).toHaveBeenCalledWith("b1"))
  })

  it("deletes a broker with no firm whose positions are all sold out", async () => {
    holds(0, 0)
    show([unlinked])
    fireEvent.click(screen.getByTitle("Delete"))

    await screen.findByText("Delete broker Local bank? It holds no positions.")
    fireEvent.click(screen.getByText("Delete", { selector: "button" }))

    await waitFor(() => expect(deleteBroker).toHaveBeenCalledWith("b2"))
  })

  it("offers to deactivate a broker that holds a position, and neither closes nor deletes it", async () => {
    holds(10, 0, 5)
    show([linked])
    fireEvent.click(screen.getByTitle("Close account"))

    expect(
      await screen.findByText(
        "My IB holds 2 position(s), so it cannot be closed. Deactivate it to stop it being offered for a new trade. Its transactions stay.",
      ),
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe("/api/trns/broker/b1/holdings")
    fireEvent.click(screen.getByText("Deactivate", { selector: "button" }))

    await waitFor(() =>
      expect(saveBroker).toHaveBeenCalledWith("b1", {
        name: "My IB",
        active: false,
      }),
    )
    expect(deleteBroker).not.toHaveBeenCalled()
  })

  it("offers to deactivate a broker the server will not delete because it has transactions", async () => {
    deleteBroker.mockRejectedValue(
      new Error("Cannot delete broker 'Local bank' - it has 4 transaction(s)."),
    )
    show([unlinked])
    fireEvent.click(screen.getByTitle("Delete"))
    await screen.findByText("Delete broker Local bank? It holds no positions.")
    fireEvent.click(screen.getByText("Delete", { selector: "button" }))

    expect(
      await screen.findByText(
        "Local bank has transactions, so it cannot be deleted. Deactivate it to stop it being offered for a new trade. Its transactions stay.",
      ),
    ).toBeInTheDocument()
  })

  it("marks a deactivated broker inactive and reactivates it on request", async () => {
    show([{ ...linked, active: false }, unlinked])

    expect(screen.getAllByText("Inactive")).toHaveLength(1)
    fireEvent.click(screen.getByTitle("Reactivate"))

    await waitFor(() =>
      expect(saveBroker).toHaveBeenCalledWith("b1", {
        name: "My IB",
        active: true,
      }),
    )
  })

  it("offers no reactivation for an active broker", () => {
    show([linked])

    expect(screen.queryByTitle("Reactivate")).not.toBeInTheDocument()
    expect(screen.queryByText("Inactive")).not.toBeInTheDocument()
  })

  it("says so, and removes nothing, when the holdings cannot be read", async () => {
    fetchMock.mockResponse(JSON.stringify({ message: "down" }), { status: 500 })
    show([unlinked])
    fireEvent.click(screen.getByTitle("Delete"))

    expect(
      await screen.findByText("Failed to read the broker's holdings"),
    ).toBeInTheDocument()
    expect(deleteBroker).not.toHaveBeenCalled()
  })
})
