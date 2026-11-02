import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import ReviewStep from "@components/features/onboarding/steps/ReviewStep"

const handlers = {
  onRemoveBankAccount: jest.fn(),
  onRemoveProperty: jest.fn(),
  onRemovePension: jest.fn(),
  onRemoveInsurance: jest.fn(),
}

const props = {
  ...handlers,
  baseCurrency: "USD",
  bankAccounts: [
    { name: "Checking", currency: "USD", balance: 1500.6 },
    { name: "Unbalanced", currency: "EUR" },
  ],
  properties: [
    { name: "Home", price: 500000, value: 650000 },
    { name: "Land", price: 100000 },
  ],
  pensions: [
    {
      name: "CPF",
      currency: "SGD",
      balance: 90000,
      payoutAge: 65,
      policyType: "CPF",
      lumpSum: true,
    },
    { name: "Plain", currency: "USD" },
  ],
  insurances: [
    {
      name: "Term",
      currency: "USD",
      currentValue: 2500,
      payoutAmount: 100000,
      payoutAge: 70,
      lumpSum: true,
    },
    { name: "Whole", currency: "USD" },
  ],
} as unknown as React.ComponentProps<typeof ReviewStep>

const empty = {
  ...props,
  bankAccounts: [],
  properties: [],
  pensions: [],
  insurances: [],
}

describe("ReviewStep", () => {
  beforeEach(() => jest.clearAllMocks())

  it("renders every asset section", () => {
    const { container } = render(<ReviewStep {...props} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the empty state", () => {
    const { container } = render(<ReviewStep {...empty} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("omits sections with no entries", () => {
    render(<ReviewStep {...empty} bankAccounts={props.bankAccounts} />)
    expect(screen.getByText("Bank Accounts")).toBeInTheDocument()
    expect(screen.queryByText("Properties")).not.toBeInTheDocument()
  })

  it("removes the chosen row of each section", () => {
    render(<ReviewStep {...props} />)
    const remove = screen.getAllByTitle("Remove")
    expect(remove).toHaveLength(8)
    fireEvent.click(remove[1])
    fireEvent.click(remove[3])
    fireEvent.click(remove[5])
    fireEvent.click(remove[7])
    expect(handlers.onRemoveBankAccount).toHaveBeenCalledWith(1)
    expect(handlers.onRemoveProperty).toHaveBeenCalledWith(1)
    expect(handlers.onRemovePension).toHaveBeenCalledWith(1)
    expect(handlers.onRemoveInsurance).toHaveBeenCalledWith(1)
  })
})
