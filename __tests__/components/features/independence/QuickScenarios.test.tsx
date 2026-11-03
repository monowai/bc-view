import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

let mockConfigs: Array<Record<string, unknown>> = []
let mockLoading = false
jest.mock("@lib/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: () => ({
    configs: mockConfigs,
    assetNames: { house: "Family Home", rental: "Beach Rental" },
    isLoading: mockLoading,
  }),
}))
jest.mock("@lib/assets/useAssetValues", () => ({
  useAssetValues: () => ({ values: { house: 800000, rental: 0 } }),
}))

import QuickScenarios from "@components/features/independence/steps/QuickScenarios"

const append = jest.fn()

async function openForm(defaultAge?: number): Promise<void> {
  render(<QuickScenarios appendDisposals={append} defaultAge={defaultAge} />)
  await userEvent.click(
    screen.getByRole("button", { name: /Sell & Downsize Property/ }),
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockLoading = false
  mockConfigs = [
    { assetId: "house", isPension: false, isPrimaryResidence: true },
    { assetId: "rental", isPension: false },
    { assetId: "cpf", isPension: true },
  ]
})

describe("QuickScenarios", () => {
  it("opens and closes the downsize form from the preset button", async () => {
    await openForm()
    expect(screen.getByText("Asset to dispose of")).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: /Sell & Downsize Property/ }),
    )
    expect(screen.queryByText("Asset to dispose of")).not.toBeInTheDocument()
  })

  it("lists only non-pension assets, tagged with primary residence and value", async () => {
    await openForm()
    expect(
      screen.getByRole("option", { name: "Family Home (primary) — $800,000" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Beach Rental" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: /cpf/ }),
    ).not.toBeInTheDocument()
  })

  it("autofills the value from the picked asset and previews the split", async () => {
    await openForm(67)
    await userEvent.selectOptions(screen.getByRole("combobox"), "house")
    expect(screen.getByDisplayValue("800000")).toBeInTheDocument()
    expect(screen.getByDisplayValue("67")).toBeInTheDocument()
    expect(screen.getByText("Preview at age 67:")).toBeInTheDocument()
    expect(screen.getByText("-$800,000")).toBeInTheDocument()
    // 50% cash, 5% costs, 45% replacement
    expect(screen.getByText("+$400,000")).toBeInTheDocument()
    expect(screen.getByText("+$360,000")).toBeInTheDocument()
    expect(screen.getByText("-$40,000")).toBeInTheDocument()
  })

  it("keeps a typed value when a different asset is picked", async () => {
    await openForm()
    await userEvent.type(screen.getByPlaceholderText(/1m or 1000000/), "2m")
    await userEvent.tab()
    await userEvent.selectOptions(screen.getByRole("combobox"), "house")
    expect(screen.getByText("-$2,000,000")).toBeInTheDocument()
  })

  it("emits a disposal for the chosen asset and closes the form", async () => {
    await openForm(70)
    await userEvent.selectOptions(screen.getByRole("combobox"), "house")
    const cash = screen.getByDisplayValue("50")
    await userEvent.clear(cash)
    await userEvent.type(cash, "30")
    await userEvent.click(screen.getByRole("button", { name: "Add events" }))
    expect(append).toHaveBeenCalledWith([
      {
        assetId: "house",
        disposalAge: 70,
        currentValue: 800000,
        cashRetainedPct: 30,
        txCostsPct: 5,
        description: "Sell and downsize property",
        enabled: true,
      },
    ])
    expect(screen.queryByText("Asset to dispose of")).not.toBeInTheDocument()
  })

  it("omits a blank description from the disposal", async () => {
    await openForm()
    await userEvent.selectOptions(screen.getByRole("combobox"), "house")
    await userEvent.clear(
      screen.getByDisplayValue("Sell and downsize property"),
    )
    await userEvent.click(screen.getByRole("button", { name: "Add events" }))
    expect(append.mock.calls[0][0][0].description).toBeUndefined()
  })

  it("accepts a manually typed asset id", async () => {
    await openForm()
    await userEvent.type(
      screen.getByPlaceholderText("Or type an asset id"),
      " x1 ",
    )
    await userEvent.type(screen.getByPlaceholderText(/1m or 1000000/), "1000")
    await userEvent.tab()
    await userEvent.click(screen.getByRole("button", { name: "Add events" }))
    expect(append.mock.calls[0][0][0]).toMatchObject({
      assetId: "x1",
      currentValue: 1000,
    })
  })

  it("will not add events until an asset and value are given", async () => {
    await openForm()
    expect(screen.getByRole("button", { name: "Add events" })).toBeDisabled()
  })

  it("warns when cash plus costs exceed the sale value", async () => {
    await openForm()
    await userEvent.selectOptions(screen.getByRole("combobox"), "house")
    const cash = screen.getByDisplayValue("50")
    await userEvent.clear(cash)
    await userEvent.type(cash, "98")
    expect(
      screen.getByText(/must not exceed 100% of property/),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add events" })).toBeDisabled()
  })

  it("warns about an out of range sale age", async () => {
    await openForm(65)
    const age = screen.getByDisplayValue("65")
    await userEvent.clear(age)
    await userEvent.type(age, "5")
    expect(
      screen.getByText("Sale age must be between 18 and 120."),
    ).toBeInTheDocument()
  })

  it("shows a loading note while assets load", async () => {
    mockLoading = true
    await openForm()
    expect(screen.getByText("Loading your assets…")).toBeInTheDocument()
  })

  it("explains when no disposable assets exist", async () => {
    mockConfigs = [{ assetId: "cpf", isPension: true }]
    await openForm()
    expect(
      screen.getByText(/No disposable assets configured/),
    ).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("cancels without emitting anything", async () => {
    await openForm()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(append).not.toHaveBeenCalled()
    expect(screen.queryByText("Asset to dispose of")).not.toBeInTheDocument()
  })
})
