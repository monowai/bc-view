import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import HeaderChatButton from "@components/layout/HeaderChatButton"
import { onChatOpen } from "@components/features/chat/chatBus"
import { usePermissions } from "@hooks/usePermissions"

const mockUsePermissions = usePermissions as jest.Mock

let mockPathname = "/holdings/[code]"
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: mockPathname }),
}))

function permissions(canUseAi: boolean, isLoading = false): void {
  mockUsePermissions.mockReturnValue({ canUseAi, isLoading })
}

describe("HeaderChatButton", () => {
  beforeEach(() => {
    mockPathname = "/holdings/[code]"
    permissions(true)
  })

  it("opens the chat", () => {
    const opened = jest.fn()
    const unsubscribe = onChatOpen(opened)
    render(<HeaderChatButton />)
    fireEvent.click(screen.getByRole("button", { name: "Open chat" }))
    unsubscribe()
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it("uses the conversation icon, not the AI analysis robot", () => {
    render(<HeaderChatButton />)
    const icon = screen.getByRole("button").querySelector("i")
    expect(icon).toHaveClass("fa-comments")
    expect(icon).not.toHaveClass("fa-robot")
  })

  it("is hidden without AI access", () => {
    permissions(false)
    render(<HeaderChatButton />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("is hidden while permissions load", () => {
    permissions(true, true)
    render(<HeaderChatButton />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("is hidden on the /chat page", () => {
    mockPathname = "/chat"
    render(<HeaderChatButton />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
