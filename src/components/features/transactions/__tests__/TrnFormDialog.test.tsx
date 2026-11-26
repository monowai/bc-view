import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import TrnFormDialog from "../TrnFormDialog"

describe("TrnFormDialog", () => {
  const renderDialog = (isDirty: boolean, onClose: () => void): void => {
    render(
      <TrnFormDialog
        title="Trade"
        isDirty={isDirty}
        onClose={onClose}
        onSubmit={jest.fn()}
        submitLabel="Save"
      >
        <input aria-label="Quantity" />
      </TrnFormDialog>,
    )
  }

  it("asks before Escape discards unsaved changes", () => {
    const onClose = jest.fn()
    renderDialog(true, onClose)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })

  it("closes on Escape when nothing has changed", () => {
    const onClose = jest.fn()
    renderDialog(false, onClose)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })
})
