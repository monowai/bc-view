import React, { useState } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useConfirm } from "@hooks/useConfirm"

function Harness(): React.ReactElement {
  const [confirm, confirmDialog] = useConfirm()
  const [result, setResult] = useState("pending")
  return (
    <>
      <button
        onClick={async () => {
          const ok = await confirm({
            title: "Revoke share",
            message: "The recipient loses access immediately.",
            confirmLabel: "Revoke",
          })
          setResult(ok ? "confirmed" : "cancelled")
        }}
      >
        Ask
      </button>
      <span data-testid="result">{result}</span>
      {confirmDialog}
    </>
  )
}

describe("useConfirm", () => {
  it("renders nothing until asked", () => {
    render(<Harness />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens a named dialog and resolves true on confirm", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText("Ask"))
    expect(
      screen.getByRole("dialog", { name: "Revoke share" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("The recipient loses access immediately."),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }))
    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("confirmed"),
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("resolves false on cancel", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText("Ask"))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("cancelled"),
    )
  })

  it("resolves false when the caller unmounts with a confirm pending", async () => {
    let pending: Promise<boolean> | undefined
    function Asker(): React.ReactElement {
      const [confirm, confirmDialog] = useConfirm()
      return (
        <>
          <button
            onClick={() => {
              pending = confirm({ title: "Delete", message: "Sure?" })
            }}
          >
            Ask
          </button>
          {confirmDialog}
        </>
      )
    }
    const { unmount } = render(<Asker />)
    fireEvent.click(screen.getByText("Ask"))
    unmount()
    await expect(pending).resolves.toBe(false)
  })
})
