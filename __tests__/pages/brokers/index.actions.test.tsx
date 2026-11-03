import React from "react"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import Brokers from "@pages/brokers"

const BrokersPage = Brokers as React.ComponentType<any>

const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

const hook = {
  brokers: [] as any[],
  accountAssets: [] as any[],
  error: undefined as Error | undefined,
  isLoading: false,
  saveBroker: jest.fn(),
  deleteBroker: jest.fn(),
  transferTransactions: jest.fn(),
}
jest.mock("@hooks/useBrokers", () => ({ useBrokers: () => hook }))

const brokers = [
  {
    id: "b1",
    name: "Alpha Broker",
    accountNumber: "ACC-1",
    notes: "primary",
    settlementAccounts: [{ currencyCode: "USD", accountId: "acc-usd" }],
  },
  { id: "b2", name: "Beta Broker", settlementAccounts: [] },
]

const bank = (id: string, name: string, currency: string): any => ({
  id,
  name,
  accountingType: { currency: { code: currency } },
})

describe("Brokers page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    hook.brokers = brokers
    hook.accountAssets = [
      bank("acc-usd", "US Bank", "USD"),
      bank("acc-sgd", "SG Bank", "SGD"),
    ]
    hook.error = undefined
    hook.isLoading = false
    hook.saveBroker.mockResolvedValue(undefined)
    hook.deleteBroker.mockResolvedValue(undefined)
    hook.transferTransactions.mockResolvedValue(undefined)
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  it("shows the loading state and the error state", () => {
    hook.isLoading = true
    const { unmount } = render(<BrokersPage />)
    expect(screen.getByTestId("loading")).toBeInTheDocument()
    unmount()
    hook.isLoading = false
    hook.error = new Error("boom")
    render(<BrokersPage />)
    expect(screen.getByText(/Error loading brokers/)).toBeInTheDocument()
  })

  it("shows an empty state that opens the add dialog", async () => {
    hook.brokers = []
    const user = userEvent.setup()
    render(<BrokersPage />)
    expect(screen.getByText("No brokers yet")).toBeInTheDocument()
    const buttons = screen.getAllByRole("button", { name: /Add Broker/ })
    await user.click(buttons[buttons.length - 1])
    expect(
      screen.getByRole("heading", { name: "Add Broker" }),
    ).toBeInTheDocument()
  })

  it("lists brokers and navigates", async () => {
    const user = userEvent.setup()
    render(<BrokersPage />)
    expect(screen.getByText("ACC-1")).toBeInTheDocument()
    expect(screen.getByText("primary")).toBeInTheDocument()
    await user.click(screen.getByText("Alpha Broker"))
    expect(mockPush).toHaveBeenCalledWith("/brokers/b1/holdings")
    await user.click(screen.getAllByTitle("Reconcile Holdings")[0])
    expect(mockPush).toHaveBeenCalledWith("/brokers/NO_BROKER/holdings")
    await user.click(screen.getAllByTitle("Back")[0])
    expect(mockBack).toHaveBeenCalled()
  })

  describe("create and edit", () => {
    it("cannot save without a name, and saves a new broker", async () => {
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getByRole("button", { name: /Add Broker/ }))
      expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
      await user.type(
        screen.getByPlaceholderText("e.g., Interactive Brokers"),
        "Gamma",
      )
      await user.type(screen.getByPlaceholderText("Optional"), "123")
      await user.type(screen.getByPlaceholderText("Optional notes"), "hi")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() =>
        expect(hook.saveBroker).toHaveBeenCalledWith(undefined, {
          name: "Gamma",
          accountNumber: "123",
          notes: "hi",
          settlementAccounts: {},
        }),
      )
      await waitFor(() =>
        expect(
          screen.queryByRole("heading", { name: "Add Broker" }),
        ).not.toBeInTheDocument(),
      )
    })

    it("edits an existing broker with its settlement accounts", async () => {
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getAllByTitle("Edit")[0])
      expect(screen.getByDisplayValue("Alpha Broker")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Settlement" }))
      const usd = screen.getByText("USD", { selector: "label" }).parentElement!
      expect(within(usd).getByRole("combobox")).toHaveValue("acc-usd")
      const sgd = screen.getByText("SGD", { selector: "label" }).parentElement!
      await user.selectOptions(within(sgd).getByRole("combobox"), "acc-sgd")
      // clearing a currency removes the mapping
      await user.selectOptions(within(usd).getByRole("combobox"), "")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(hook.saveBroker).toHaveBeenCalled())
      expect(hook.saveBroker.mock.calls[0][0]).toBe("b1")
      expect(hook.saveBroker.mock.calls[0][1].settlementAccounts).toEqual({
        SGD: "acc-sgd",
      })
    })

    it("keeps a selected account listed even when its currency does not match", async () => {
      hook.brokers = [
        {
          id: "b1",
          name: "Alpha",
          settlementAccounts: [{ currencyCode: "EUR", accountId: "acc-usd" }],
        },
      ]
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getByTitle("Edit"))
      await user.click(screen.getByRole("button", { name: "Settlement" }))
      const eur = screen.getByText("EUR", { selector: "label" }).parentElement!
      expect(
        within(eur).getByRole("option", { name: "US Bank" }),
      ).toBeInTheDocument()
    })

    it("warns when there are no bank accounts for settlement", async () => {
      hook.accountAssets = []
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getByRole("button", { name: /Add Broker/ }))
      await user.click(screen.getByRole("button", { name: "Settlement" }))
      expect(screen.getByText(/No bank accounts found/)).toBeInTheDocument()
    })

    it("keeps the dialog open when saving fails, and cancel closes it", async () => {
      hook.saveBroker.mockRejectedValue(new Error("nope"))
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getByRole("button", { name: /Add Broker/ }))
      await user.type(
        screen.getByPlaceholderText("e.g., Interactive Brokers"),
        "X",
      )
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(hook.saveBroker).toHaveBeenCalled())
      expect(
        screen.getByRole("heading", { name: "Add Broker" }),
      ).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(
        screen.queryByRole("heading", { name: "Add Broker" }),
      ).not.toBeInTheDocument()
    })
  })

  describe("delete and transfer", () => {
    const confirmDelete = async (
      user: ReturnType<typeof userEvent.setup>,
    ): Promise<void> => {
      await user.click(screen.getAllByTitle("Delete")[0])
      expect(
        screen.getByText(/Delete broker Alpha Broker and all associated data/),
      ).toBeInTheDocument()
      await user.click(
        screen.getAllByRole("button", { name: "Delete" }).pop() as HTMLElement,
      )
    }

    it("deletes after confirmation", async () => {
      const user = userEvent.setup()
      render(<BrokersPage />)
      await confirmDelete(user)
      await waitFor(() => expect(hook.deleteBroker).toHaveBeenCalledWith("b1"))
    })

    it("cancelling the delete confirmation does nothing", async () => {
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getAllByTitle("Delete")[0])
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(hook.deleteBroker).not.toHaveBeenCalled()
    })

    it("offers a transfer when delete fails because of transactions", async () => {
      hook.deleteBroker.mockRejectedValue(new Error("Broker has transactions"))
      const user = userEvent.setup()
      render(<BrokersPage />)
      await confirmDelete(user)
      expect(
        await screen.findByText("Broker has transactions"),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Transfer all transactions from "Alpha Broker"/),
      ).toBeInTheDocument()
    })

    it("transfers transactions to the chosen broker and announces success", async () => {
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getAllByTitle("Transfer Transactions")[0])
      const submit = screen.getByRole("button", { name: "Transfer" })
      expect(submit).toBeDisabled()
      const select = screen.getByRole("combobox")
      expect(
        within(select).queryByRole("option", { name: "Alpha Broker" }),
      ).toBeNull()
      await user.selectOptions(select, "b2")
      await user.click(submit)
      await waitFor(() =>
        expect(hook.transferTransactions).toHaveBeenCalledWith("b1", "b2"),
      )
      expect(
        await screen.findByText("Transactions transferred successfully"),
      ).toBeInTheDocument()
    })

    it("shows the error when a transfer fails, and cancel closes the dialog", async () => {
      hook.transferTransactions.mockRejectedValue(new Error("transfer broke"))
      const user = userEvent.setup()
      render(<BrokersPage />)
      await user.click(screen.getAllByTitle("Transfer Transactions")[0])
      await user.selectOptions(screen.getByRole("combobox"), "b2")
      await user.click(screen.getByRole("button", { name: "Transfer" }))
      expect(await screen.findByText("transfer broke")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(screen.queryByText("transfer broke")).not.toBeInTheDocument()
    })

    it("falls back to a generic message for non-Error delete failures", async () => {
      hook.deleteBroker.mockRejectedValue("bad")
      const user = userEvent.setup()
      render(<BrokersPage />)
      await act(async () => {
        await confirmDelete(user)
      })
      // generic message contains no 'transaction', so no transfer dialog
      expect(
        screen.queryByText(/Transfer all transactions/),
      ).not.toBeInTheDocument()
    })
  })
})
