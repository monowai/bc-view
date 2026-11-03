import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceSettingsPanel from "@components/features/independence/IndependenceSettingsPanel"

const mockUpdateSettings = jest.fn()
let mockSettings: Record<string, number | undefined> | undefined

jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}))

const save = (): void => {
  fireEvent.click(screen.getByRole("button", { name: /Save Settings/ }))
}

describe("IndependenceSettingsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdateSettings.mockResolvedValue({})
    mockSettings = {
      yearOfBirth: 1980,
      monthOfBirth: 6,
      targetIndependenceAge: 60,
      lifeExpectancy: 85,
    }
  })

  it("should seed the fields and show the planning horizon", () => {
    render(<IndependenceSettingsPanel />)
    expect(screen.getByLabelText("Year of Birth")).toHaveValue(1980)
    expect(screen.getByLabelText("Month of Birth")).toHaveValue("6")
    expect(screen.getByText(/planning horizon will be/)).toHaveTextContent(
      "25 years (from age 60 to 85)",
    )
  })

  it("should leave fields empty and require a year when settings are unset", () => {
    mockSettings = undefined
    render(<IndependenceSettingsPanel />)
    expect(screen.getByLabelText("Year of Birth")).toHaveValue(null)
    expect(screen.getByText("Currently —")).toBeInTheDocument()
    save()
    expect(screen.getByText("Year of birth is required")).toBeInTheDocument()
    expect(mockUpdateSettings).not.toHaveBeenCalled()
  })

  it("should reject life expectancy at or before the target age", () => {
    render(<IndependenceSettingsPanel />)
    fireEvent.change(screen.getByLabelText("Life Expectancy"), {
      target: { value: "60" },
    })
    save()
    expect(
      screen.getByText("Life expectancy must be after target independence age"),
    ).toBeInTheDocument()
  })

  it("should save and confirm", async () => {
    render(<IndependenceSettingsPanel />)
    save()
    await waitFor(() =>
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        yearOfBirth: 1980,
        monthOfBirth: 6,
        targetIndependenceAge: 60,
        lifeExpectancy: 85,
      }),
    )
    expect(
      await screen.findByText("Settings saved successfully."),
    ).toBeInTheDocument()
  })

  it("should report a failed save", async () => {
    mockUpdateSettings.mockRejectedValue(new Error("boom"))
    render(<IndependenceSettingsPanel />)
    save()
    expect(
      await screen.findByText("Failed to save settings. Please try again."),
    ).toBeInTheDocument()
  })
})
