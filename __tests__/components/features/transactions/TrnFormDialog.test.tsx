import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import TrnFormDialog from "@components/features/transactions/TrnFormDialog"
import { copyToClipboard } from "@lib/trns/formUtils"

jest.mock("@lib/trns/formUtils", () => ({
  ...jest.requireActual("@lib/trns/formUtils"),
  copyToClipboard: jest.fn(() => Promise.resolve(true)),
}))

const renderDialog = (
  props: Partial<React.ComponentProps<typeof TrnFormDialog>> = {},
): { onClose: jest.Mock; onSubmit: jest.Mock } => {
  const onClose = jest.fn()
  const onSubmit = jest.fn()
  render(
    <TrnFormDialog
      title="Deposit cash"
      subtitle="PF1 · Main"
      isDirty={false}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Submit"
      copyRow={() => "row,1"}
      summary={<span>summary-line</span>}
      {...props}
    >
      <input aria-label="amount" />
    </TrnFormDialog>,
  )
  return { onClose, onSubmit }
}

describe("TrnFormDialog", () => {
  beforeEach(() => jest.clearAllMocks())

  it("shows the title, the context line and the summary", () => {
    renderDialog()
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Deposit cash")
    expect(screen.getByText("PF1 · Main")).toBeInTheDocument()
    expect(screen.getByText("summary-line")).toBeInTheDocument()
  })

  it("closes straight away when nothing has changed", () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("asks before throwing away changes", () => {
    const { onClose } = renderDialog({ isDirty: true })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps the form open when the user chooses to keep editing", () => {
    const { onClose } = renderDialog({ isDirty: true })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument()
  })

  it("copies the row and confirms it", async () => {
    renderDialog()
    fireEvent.click(screen.getByTitle("Copy"))
    await act(() => Promise.resolve())
    expect(copyToClipboard).toHaveBeenCalledWith("row,1")
    expect(screen.getByTitle("Copied")).toBeInTheDocument()
  })

  it("submits from the button bar", () => {
    const { onSubmit } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Submit" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})
