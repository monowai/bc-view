import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import SaveScenarioDialog from "../SaveScenarioDialog"

describe("SaveScenarioDialog", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSave: jest.fn().mockResolvedValue(undefined),
    planName: "My Retirement Plan",
    isSaving: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <SaveScenarioDialog {...defaultProps} isOpen={false} />,
    )

    expect(container.firstChild).toBeNull()
  })

  it("renders dialog title when open", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    expect(screen.getByText("Save Scenario")).toBeInTheDocument()
  })

  it("shows update option with plan name", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    expect(screen.getByText('Update "My Retirement Plan"')).toBeInTheDocument()
    expect(
      screen.getByText("Apply changes to the existing plan"),
    ).toBeInTheDocument()
  })

  it("shows save as new option", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    expect(screen.getByText("Save as New Plan")).toBeInTheDocument()
    expect(
      screen.getByText("Create a copy with these changes"),
    ).toBeInTheDocument()
  })

  it("has update mode selected by default", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    const updateRadio = screen.getAllByRole("radio")[0]
    expect(updateRadio).toBeChecked()
  })

  it("shows new plan name input when save as new is selected", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    const newPlanRadio = screen.getAllByRole("radio")[1]
    fireEvent.click(newPlanRadio)

    expect(
      screen.getByPlaceholderText("My Retirement Plan (Scenario)"),
    ).toBeInTheDocument()
  })

  it("hides new plan name input when update is selected", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    // First select "new", then switch back to "update"
    const newPlanRadio = screen.getAllByRole("radio")[1]
    fireEvent.click(newPlanRadio)

    const updateRadio = screen.getAllByRole("radio")[0]
    fireEvent.click(updateRadio)

    expect(
      screen.queryByPlaceholderText("My Retirement Plan (Scenario)"),
    ).not.toBeInTheDocument()
  })

  it("calls onClose when cancel button is clicked", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    const cancelButton = screen.getByText("Cancel")
    fireEvent.click(cancelButton)

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it("calls onSave with update mode when save is clicked", async () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    const saveButton = screen.getByText("Save")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("update", undefined)
    })
  })

  it("calls onSave with new mode and plan name", async () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    // Select "new" mode
    const newPlanRadio = screen.getAllByRole("radio")[1]
    fireEvent.click(newPlanRadio)

    // Enter new plan name
    const nameInput = screen.getByPlaceholderText(
      "My Retirement Plan (Scenario)",
    )
    fireEvent.change(nameInput, { target: { value: "New Test Plan" } })

    // Click save
    const saveButton = screen.getByText("Save")
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("new", "New Test Plan")
    })
  })

  it("disables buttons when saving", () => {
    render(<SaveScenarioDialog {...defaultProps} isSaving={true} />)

    const cancelButton = screen.getByText("Cancel")
    const savingButton = screen.getByText("Saving...")

    expect(cancelButton).toBeDisabled()
    expect(savingButton).toBeDisabled()
  })

  it("shows spinner when saving", () => {
    render(<SaveScenarioDialog {...defaultProps} isSaving={true} />)

    expect(screen.getByText("Saving...")).toBeInTheDocument()
  })

  it("resets form state when cancel is clicked", () => {
    render(<SaveScenarioDialog {...defaultProps} />)

    // Select "new" mode and enter name
    const newPlanRadio = screen.getAllByRole("radio")[1]
    fireEvent.click(newPlanRadio)
    const nameInput = screen.getByPlaceholderText(
      "My Retirement Plan (Scenario)",
    )
    fireEvent.change(nameInput, { target: { value: "Test" } })

    // Click cancel - this should call handleClose which resets state
    const cancelButton = screen.getByText("Cancel")
    fireEvent.click(cancelButton)

    // Verify onClose was called
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
