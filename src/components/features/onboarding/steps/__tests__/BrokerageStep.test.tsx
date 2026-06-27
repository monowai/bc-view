import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import BrokerageStep from "../BrokerageStep"
import type { BrokerageStepProps } from "../BrokerageStep"
import type { Portfolio } from "types/beancounter"

const existingPortfolios = [
  {
    id: "pf-1",
    code: "MAIN",
    name: "Main",
    currency: { code: "SGD" },
  },
] as unknown as Portfolio[]

const baseProps: BrokerageStepProps = {
  enabled: true,
  brokerName: "IBKR",
  source: "",
  amount: "",
  currency: "SGD",
  currencyCodes: ["SGD", "USD"],
  existingPortfolios,
  bankAccounts: [],
  defaultPortfolioName: "Cash",
  portfolioMode: "new",
  onEnabledChange: jest.fn(),
  onBrokerNameChange: jest.fn(),
  onSourceChange: jest.fn(),
  onAmountChange: jest.fn(),
  onCurrencyChange: jest.fn(),
  onPortfolioModeChange: jest.fn(),
}

const renderStep = (overrides: Partial<BrokerageStepProps> = {}): void => {
  render(<BrokerageStep {...baseProps} {...overrides} />)
}

describe("BrokerageStep portfolio choice", () => {
  it("shows the currency picker next to the broker name in both modes", () => {
    renderStep({ portfolioMode: "new" })
    expect(screen.getByLabelText("Currency")).toBeInTheDocument()
    expect(screen.getByLabelText("Broker name")).toBeInTheDocument()
    // Shared chooser offers Zen + Master.
    expect(
      screen.getByRole("radio", { name: /Master Mode/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Zen Mode/i })).toBeInTheDocument()
  })

  it("surfaces the computed brokerage code and cash-account name", () => {
    renderStep({ brokerName: "Interactive Brokers", currency: "USD" })
    // deriveBrokerCode("Interactive Brokers") === "IB"
    expect(screen.getByText("IB")).toBeInTheDocument()
    expect(screen.getByText("IB-USD")).toBeInTheDocument()
  })

  it("new (Master) mode shows the new-portfolio box plus opening deposit + source", () => {
    renderStep({ portfolioMode: "new", brokerName: "Interactive Brokers" })
    expect(
      screen.getByText("Interactive Brokers Portfolio"),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Opening deposit/i)).toBeInTheDocument()
    expect(screen.getByLabelText("Source (optional)")).toBeInTheDocument()
  })

  it("existing (Zen) mode hides deposit + source and shows the attach note", () => {
    renderStep({ portfolioMode: "existing", brokerName: "Interactive Brokers" })
    expect(screen.queryByLabelText(/Opening deposit/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Source (optional)")).not.toBeInTheDocument()
    // Zen attaches to the user's main portfolio — no portfolio picker.
    expect(
      screen.getByText(/attaches to your main portfolio/i),
    ).toBeInTheDocument()
  })
})
