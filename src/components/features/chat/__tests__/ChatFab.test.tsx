import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ChatFab from "../ChatFab"

// react-markdown / remark-gfm mocked globally in jest.setup.js

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/wealth", query: {}, push: mockPush }),
}))

// Mock fetch for useChat
global.fetch = jest.fn()

describe("ChatFab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.removeItem("bc-chat-corner")
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

  it("FAB unmounts while the panel is open and the header Close X dismisses it", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    expect(screen.queryByLabelText("Chat")).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Close chat"))
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-[calc(100%+1.5rem)]")
    expect(panel.className).toContain("pointer-events-none")
    expect(screen.getByLabelText("Chat")).toBeInTheDocument()
  })

  it("closes panel on Escape key", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-[calc(100%+1.5rem)]")
    expect(panel.className).toContain("pointer-events-none")
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
