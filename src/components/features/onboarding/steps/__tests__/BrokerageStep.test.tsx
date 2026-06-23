import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
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
  existingPortfolioId: "",
  onEnabledChange: jest.fn(),
  onBrokerNameChange: jest.fn(),
  onSourceChange: jest.fn(),
  onAmountChange: jest.fn(),
  onCurrencyChange: jest.fn(),
  onPortfolioModeChange: jest.fn(),
  onExistingPortfolioChange: jest.fn(),
}

const renderStep = (overrides: Partial<BrokerageStepProps> = {}): void => {
  render(<BrokerageStep {...baseProps} {...overrides} />)
}

describe("BrokerageStep portfolio choice", () => {
  it("new mode shows the currency picker, not the existing-portfolio selector", () => {
    renderStep({ portfolioMode: "new" })
    expect(screen.getByLabelText("Default Currency")).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Existing portfolio"),
    ).not.toBeInTheDocument()
    // Shared chooser is present.
    expect(
      screen.getByRole("radio", {
        name: /Create a new portfolio for this brokerage/i,
      }),
    ).toBeInTheDocument()
  })

  it("existing mode shows the existing-portfolio selector, not the currency picker", () => {
    renderStep({ portfolioMode: "existing" })
    const select = screen.getByLabelText("Existing portfolio")
    expect(select).toBeInTheDocument()
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.textContent),
    ).toContain("Main (MAIN, SGD)")
    expect(screen.queryByLabelText("Default Currency")).not.toBeInTheDocument()
  })

  it("selecting the existing portfolio reports its id", () => {
    const onExistingPortfolioChange = jest.fn()
    renderStep({ portfolioMode: "existing", onExistingPortfolioChange })
    fireEvent.change(screen.getByLabelText("Existing portfolio"), {
      target: { value: "pf-1" },
    })
    expect(onExistingPortfolioChange).toHaveBeenCalledWith("pf-1")
  })
})
