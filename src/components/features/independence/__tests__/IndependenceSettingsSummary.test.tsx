import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceSettingsSummary from "../IndependenceSettingsSummary"

let mockSettings: Record<string, unknown> = {}

jest.mock("@components/features/independence/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: mockSettings,
    isLoading: false,
    updateSettings: jest.fn(),
  }),
}))

describe("IndependenceSettingsSummary", () => {
  it("shows the target age for a user still working", () => {
    mockSettings = {
      yearOfBirth: 1980,
      targetIndependenceAge: 60,
      lifeExpectancy: 90,
      retiredOn: null,
    }
    render(<IndependenceSettingsSummary />)
    expect(screen.getByText("Target Independence Age")).toBeInTheDocument()
    expect(screen.queryByText(/retired since/i)).not.toBeInTheDocument()
  })

  it("shows when a retired user retired instead of the target age", () => {
    mockSettings = {
      yearOfBirth: 1960,
      monthOfBirth: 6,
      targetIndependenceAge: 70,
      lifeExpectancy: 90,
      retiredOn: "2024-03-01",
    }
    render(<IndependenceSettingsSummary />)
    expect(screen.getByText("Retired since March 2024")).toBeInTheDocument()
    expect(
      screen.queryByText("Target Independence Age"),
    ).not.toBeInTheDocument()
  })
})
