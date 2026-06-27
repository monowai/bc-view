import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import BrokerageStep from "../BrokerageStep"
import type { BrokerageStepProps } from "../BrokerageStep"

const baseProps: BrokerageStepProps = {
  enabled: true,
  brokerName: "IBKR",
  currencies: ["SGD"],
  currencyCodes: ["SGD", "USD"],
  defaultPortfolioName: "Cash",
  portfolioMode: "new",
  onEnabledChange: jest.fn(),
  onBrokerNameChange: jest.fn(),
  onCurrenciesChange: jest.fn(),
  onPortfolioModeChange: jest.fn(),
}

const renderStep = (overrides: Partial<BrokerageStepProps> = {}): void => {
  render(<BrokerageStep {...baseProps} {...overrides} />)
}

describe("BrokerageStep", () => {
  it("offers a currency toggle per available code in both modes", () => {
    renderStep({ portfolioMode: "new" })
    expect(screen.getByRole("checkbox", { name: "SGD" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "USD" })).toBeInTheDocument()
    expect(screen.getByLabelText("Broker name")).toBeInTheDocument()
    // Shared chooser offers Zen + Master.
    expect(
      screen.getByRole("radio", { name: /Master Mode/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Zen Mode/i })).toBeInTheDocument()
  })

  it("reflects the selected currencies as checked", () => {
    renderStep({ currencies: ["SGD", "USD"] })
    expect(screen.getByRole("checkbox", { name: "SGD" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "USD" })).toBeChecked()
  })

  it("adds a currency on toggle", () => {
    const onCurrenciesChange = jest.fn()
    renderStep({ currencies: ["SGD"], onCurrenciesChange })
    fireEvent.click(screen.getByRole("checkbox", { name: "USD" }))
    expect(onCurrenciesChange).toHaveBeenCalledWith(["SGD", "USD"])
  })

  it("removes a currency on toggle", () => {
    const onCurrenciesChange = jest.fn()
    renderStep({ currencies: ["SGD", "USD"], onCurrenciesChange })
    fireEvent.click(screen.getByRole("checkbox", { name: "SGD" }))
    expect(onCurrenciesChange).toHaveBeenCalledWith(["USD"])
  })

  it("previews the broker code and a cash account per selected currency", () => {
    renderStep({
      brokerName: "Interactive Brokers",
      currencies: ["USD", "SGD"],
    })
    // deriveBrokerCode("Interactive Brokers") === "IB"
    expect(screen.getByText("IB")).toBeInTheDocument()
    expect(screen.getByText(/IB-USD/)).toBeInTheDocument()
    expect(screen.getByText(/IB-SGD/)).toBeInTheDocument()
  })

  it("never shows an opening-deposit or source field (balances recorded later)", () => {
    renderStep({ portfolioMode: "new", brokerName: "Interactive Brokers" })
    expect(screen.queryByLabelText(/Opening deposit/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Source/i)).not.toBeInTheDocument()
  })

  it("Master mode shows the dedicated-portfolio box", () => {
    renderStep({ portfolioMode: "new", brokerName: "Interactive Brokers" })
    expect(
      screen.getByText("Interactive Brokers Portfolio"),
    ).toBeInTheDocument()
  })

  it("Zen mode shows the attach note", () => {
    renderStep({ portfolioMode: "existing", brokerName: "Interactive Brokers" })
    expect(
      screen.getByText(/attaches to your main portfolio/i),
    ).toBeInTheDocument()
  })
})
