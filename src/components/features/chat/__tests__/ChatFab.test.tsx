import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ChatFab from "../ChatFab"

jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})

jest.mock("remark-gfm", () => () => {})

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/wealth", query: {}, push: mockPush }),
}))

// Mock fetch for useChat
global.fetch = jest.fn()

describe("ChatFab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the FAB button", () => {
    render(<ChatFab />)
    expect(screen.getByLabelText("Chat")).toBeInTheDocument()
  })

  it("opens panel when FAB is clicked", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
  })

  it("closes panel when FAB is clicked again", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("Chat"))
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-full")
  })

  it("closes panel on Escape key", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-full")
  })

  it("expand button toggles expanded panel size", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("w-96")

    fireEvent.click(screen.getByLabelText("Expand chat"))
    expect(panel.className).toContain("w-[48rem]")
    expect(mockPush).not.toHaveBeenCalled()

    // Toggle back to compact
    fireEvent.click(screen.getByLabelText("Expand chat"))
    expect(panel.className).toContain("w-96")
  })
})
