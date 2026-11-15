import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import BrokersPage from "@pages/brokers/index"
import { useBrokers } from "@hooks/useBrokers"
import { useGlobalBrokers } from "@hooks/useGlobalBrokers"
import type { BrokerWithAccounts, GlobalBroker } from "types/beancounter"

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
      deleteBroker: jest.fn(),
      transferTransactions: jest.fn(),
    })
    mockUseGlobalBrokers.mockReturnValue({ globalBrokers })
    render(<BrokersPage />)
  }

  beforeEach(() => {
    saveBroker.mockReset().mockResolvedValue(undefined)
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
})
