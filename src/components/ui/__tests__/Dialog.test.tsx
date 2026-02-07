import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import Dialog from "../Dialog"

describe("Dialog", () => {
  const defaultProps = {
    title: "Test Dialog",
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders title and children", () => {
    render(
      <Dialog {...defaultProps}>
        <p>Dialog content</p>
      </Dialog>,
    )
    expect(screen.getByText("Test Dialog")).toBeInTheDocument()
    expect(screen.getByText("Dialog content")).toBeInTheDocument()
  })

  it("calls onClose when backdrop is clicked", () => {
    const { container } = render(
      <Dialog {...defaultProps}>
        <p>Content</p>
      </Dialog>,
    )
    // Backdrop is the second div (first child is overlay, second is backdrop)
    const backdrop = container.querySelector(".bg-black.opacity-50")
    fireEvent.click(backdrop!)
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it("calls onClose when close button is clicked", () => {
    render(
      <Dialog {...defaultProps}>
        <p>Content</p>
      </Dialog>,
    )
    fireEvent.click(screen.getByText("×"))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it("does not call onClose when dialog body is clicked", () => {
    render(
      <Dialog {...defaultProps}>
        <p>Content</p>
      </Dialog>,
    )
    fireEvent.click(screen.getByText("Content"))
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it("renders footer when provided", () => {
    render(
      <Dialog {...defaultProps} footer={<button>Save</button>}>
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByText("Save")).toBeInTheDocument()
  })

  it("does not render footer section when not provided", () => {
    const { container } = render(
      <Dialog {...defaultProps}>
        <p>Content</p>
      </Dialog>,
    )
    expect(container.querySelector(".border-t")).not.toBeInTheDocument()
  })

  it("applies scrollable classes when scrollable is true", () => {
    const { container } = render(
      <Dialog {...defaultProps} scrollable>
        <p>Content</p>
      </Dialog>,
    )
    const innerContainer = container.querySelector(".overflow-hidden")
    expect(innerContainer).toBeInTheDocument()
  })

  it("applies correct maxWidth class", () => {
    const { container } = render(
      <Dialog {...defaultProps} maxWidth="lg">
        <p>Content</p>
      </Dialog>,
    )
    expect(container.querySelector(".max-w-lg")).toBeInTheDocument()
  })
})

describe("Dialog.CancelButton", () => {
  it("renders with default label", () => {
    render(<Dialog.CancelButton onClick={jest.fn()} />)
    expect(screen.getByText("Cancel")).toBeInTheDocument()
  })

  it("renders with custom label", () => {
    render(<Dialog.CancelButton onClick={jest.fn()} label="Close" />)
    expect(screen.getByText("Close")).toBeInTheDocument()
  })

  it("calls onClick when clicked", () => {
    const onClick = jest.fn()
    render(<Dialog.CancelButton onClick={onClick} />)
    fireEvent.click(screen.getByText("Cancel"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe("Dialog.SubmitButton", () => {
  it("renders label", () => {
    render(<Dialog.SubmitButton onClick={jest.fn()} label="Save" />)
    expect(screen.getByText("Save")).toBeInTheDocument()
  })

  it("shows spinner when submitting", () => {
    render(
      <Dialog.SubmitButton
        onClick={jest.fn()}
        label="Save"
        loadingLabel="Saving..."
        isSubmitting
      />,
    )
    expect(screen.getByText("Saving...")).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("is disabled when disabled prop is true", () => {
    render(<Dialog.SubmitButton onClick={jest.fn()} label="Save" disabled />)
    expect(screen.getByRole("button")).toBeDisabled()
  })
})

describe("Dialog.ErrorAlert", () => {
  it("renders error message", () => {
    render(<Dialog.ErrorAlert message="Something went wrong" />)
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("returns null when message is null", () => {
    const { container } = render(<Dialog.ErrorAlert message={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe("Dialog.SuccessAlert", () => {
  it("renders success message", () => {
    render(<Dialog.SuccessAlert message="Operation succeeded" />)
    expect(screen.getByText("Operation succeeded")).toBeInTheDocument()
  })

  it("returns null when message is null", () => {
    const { container } = render(<Dialog.SuccessAlert message={null} />)
    expect(container.firstChild).toBeNull()
  })
})
