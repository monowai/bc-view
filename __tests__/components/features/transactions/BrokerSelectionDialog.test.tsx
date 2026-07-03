import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import BrokerSelectionDialog from "@components/features/transactions/BrokerSelectionDialog"

const brokers = [
  { id: "b1", name: "Broker A", accounts: [], settlementAccounts: [] },
]
const held = { "Broker A": 100 }

describe("BrokerSelectionDialog", () => {
  it("renders the title", () => {
    render(
      <BrokerSelectionDialog
        held={held}
        brokers={brokers}
        quantity={50}
        onSelect={jest.fn()}
        onSkip={jest.fn()}
      />,
    )
    expect(screen.getByText("Select Broker")).toBeInTheDocument()
  })

  it("calls onSkip on Escape", () => {
    const onSkip = jest.fn()
    render(
      <BrokerSelectionDialog
        held={held}
        brokers={brokers}
        quantity={50}
        onSelect={jest.fn()}
        onSkip={onSkip}
      />,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onSkip).toHaveBeenCalled()
  })
})
