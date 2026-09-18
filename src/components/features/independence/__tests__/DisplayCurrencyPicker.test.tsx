import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { RetirementPlan } from "types/independence"
import DisplayCurrencyPicker from "../DisplayCurrencyPicker"

const plan = (id: string, currency: string): RetirementPlan =>
  ({ id, name: id, expensesCurrency: currency }) as RetirementPlan

describe("DisplayCurrencyPicker", () => {
  it("offers every currency the stages are denominated in", () => {
    render(
      <DisplayCurrencyPicker
        plans={[plan("p1", "SGD"), plan("p2", "NZD")]}
        value="SGD"
        onChange={jest.fn()}
      />,
    )
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(["SGD", "NZD"])
    expect(select.value).toBe("SGD")
  })

  it("keeps showing a saved currency no stage uses any more", () => {
    // The journey's saved choice outlives the stage it came from. Dropping it
    // would leave a controlled select displaying the first option while state
    // held something else — the plan normalised into a currency the screen
    // never named.
    render(
      <DisplayCurrencyPicker
        plans={[plan("p1", "SGD"), plan("p2", "NZD")]}
        value="GBP"
        onChange={jest.fn()}
      />,
    )
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toContain("GBP")
    expect(select.value).toBe("GBP")
  })

  it("stays out of the way when there is nothing to choose between", () => {
    const { container } = render(
      <DisplayCurrencyPicker
        plans={[plan("p1", "SGD"), plan("p2", "SGD")]}
        value="SGD"
        onChange={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
