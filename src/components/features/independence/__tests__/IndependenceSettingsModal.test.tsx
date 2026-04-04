import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import IndependenceSettingsModal from "../IndependenceSettingsModal"

const mockUpdateSettings = jest.fn().mockResolvedValue({})
const mockMutateSettings = jest.fn()

jest.mock("@hooks/useIndependenceSettings", () => ({
  useIndependenceSettings: () => ({
    settings: {
      id: "test-id",
      ownerId: "test-owner",
      yearOfBirth: 1971,
      monthOfBirth: 6,
      targetIndependenceAge: 65,
      lifeExpectancy: 90,
      createdDate: "2026-01-01",
      updatedDate: "2026-01-01",
    },
    settingsError: undefined,
    isLoading: false,
    updateSettings: mockUpdateSettings,
    mutateSettings: mockMutateSettings,
  }),
}))

const currentYear = new Date().getFullYear()

describe("IndependenceSettingsModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <IndependenceSettingsModal isOpen={false} onClose={jest.fn()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders settings fields when open", () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    expect(screen.getByLabelText(/year of birth/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/month of birth/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/target independence age/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/life expectancy/i)).toBeInTheDocument()
  })

  it("displays current age derived from birth date", () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    // Age depends on current month relative to June birth month
    const expectedAge = currentYear - 1971
    expect(screen.getByText(/Currently/)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`${expectedAge - 1}|${expectedAge}`)),
    ).toBeInTheDocument()
  })

  it("shows planning horizon info", () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    expect(
      screen.getByText(/25 years \(from age 65 to 90\)/),
    ).toBeInTheDocument()
  })

  it("calls updateSettings with monthOfBirth on save", async () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    fireEvent.click(screen.getByText(/save settings/i))

    await waitFor(() => {
      expect(mockUpdateSettings).toHaveBeenCalledWith({
        yearOfBirth: 1971,
        monthOfBirth: 6,
        targetIndependenceAge: 65,
        lifeExpectancy: 90,
      })
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it("calls onClose when cancel is clicked", () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    fireEvent.click(screen.getByText(/cancel/i))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("initializes with settings values", () => {
    render(<IndependenceSettingsModal {...defaultProps} />)

    expect(screen.getByLabelText(/year of birth/i)).toHaveValue(1971)
    expect(screen.getByLabelText(/target independence age/i)).toHaveValue(65)
    expect(screen.getByLabelText(/life expectancy/i)).toHaveValue(90)
  })
})
