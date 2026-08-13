import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import BrokerSelect, { confirmBrokerSelection } from "../BrokerSelect"
import { BrokerWithAccounts } from "types/beancounter"

void React

function makeBroker(
  overrides: Partial<BrokerWithAccounts> = {},
): BrokerWithAccounts {
  return {
    id: "broker-1",
    name: "Interactive Brokers",
    settlementAccounts: [],
    ...overrides,
  }
}

describe("BrokerSelect", () => {
  it("renders a '-- No broker --' option plus one option per broker", () => {
    const brokers = [
      makeBroker({ id: "b1", name: "IBKR", accountNumber: "U123" }),
      makeBroker({ id: "b2", name: "Schwab" }),
    ]

    render(
      <BrokerSelect
        brokers={brokers}
        value={undefined}
        onChange={() => {}}
        className="my-class"
      />,
    )

    expect(screen.getByText("-- No broker --")).toBeInTheDocument()
    expect(screen.getByText("IBKR (U123)")).toBeInTheDocument()
    expect(screen.getByText("Schwab")).toBeInTheDocument()
  })

  it("calls onChange with the selected broker id", () => {
    const onChange = jest.fn()
    const brokers = [makeBroker({ id: "b1", name: "IBKR" })]

    render(
      <BrokerSelect
        brokers={brokers}
        value={undefined}
        onChange={onChange}
        className=""
      />,
    )

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "b1" },
    })

    expect(onChange).toHaveBeenCalledWith("b1")
  })

  it("calls onChange with undefined when reset to the no-broker option", () => {
    const onChange = jest.fn()
    const brokers = [makeBroker({ id: "b1", name: "IBKR" })]

    render(
      <BrokerSelect
        brokers={brokers}
        value="b1"
        onChange={onChange}
        className=""
      />,
    )

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } })

    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it("applies the caller-supplied className to the select element", () => {
    render(
      <BrokerSelect
        brokers={[]}
        value={undefined}
        onChange={() => {}}
        className="w-full focus:ring-blue-500"
      />,
    )

    expect(screen.getByRole("combobox")).toHaveClass(
      "w-full",
      "focus:ring-blue-500",
    )
  })

  it("forwards an optional id to the select so a label can target it via htmlFor", () => {
    render(
      <BrokerSelect
        brokers={[]}
        value={undefined}
        onChange={() => {}}
        className=""
        id="invest-cash-broker"
      />,
    )

    expect(screen.getByRole("combobox")).toHaveAttribute(
      "id",
      "invest-cash-broker",
    )
  })

  it("omits the id attribute when none is supplied", () => {
    render(
      <BrokerSelect
        brokers={[]}
        value={undefined}
        onChange={() => {}}
        className=""
      />,
    )

    expect(screen.getByRole("combobox")).not.toHaveAttribute("id")
  })
})

describe("confirmBrokerSelection", () => {
  const originalConfirm = window.confirm

  afterEach(() => {
    window.confirm = originalConfirm
  })

  it("returns true without prompting when 1 or fewer brokers exist", () => {
    window.confirm = jest.fn()

    expect(confirmBrokerSelection(0, undefined)).toBe(true)
    expect(confirmBrokerSelection(1, undefined)).toBe(true)
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it("returns true without prompting when a broker is already selected", () => {
    window.confirm = jest.fn()

    expect(confirmBrokerSelection(3, "broker-1")).toBe(true)
    expect(window.confirm).not.toHaveBeenCalled()
  })

  it("prompts and returns the user's answer when >1 brokers exist and none is selected", () => {
    window.confirm = jest.fn().mockReturnValue(true)
    expect(confirmBrokerSelection(2, undefined)).toBe(true)
    expect(window.confirm).toHaveBeenCalledWith(
      "No broker selected. Your proposed transactions won't be tagged with a broker. Continue?",
    )

    window.confirm = jest.fn().mockReturnValue(false)
    expect(confirmBrokerSelection(2, undefined)).toBe(false)
  })
})
