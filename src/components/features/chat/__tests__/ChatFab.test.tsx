import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ChatFab from "../ChatFab"

jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})

jest.mock("remark-gfm", () => () => {})

jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/wealth", query: {} }),
}))

// Mock fetch for useChat
global.fetch = jest.fn()

describe("ChatFab", () => {
  it("renders the FAB button", () => {
    render(<ChatFab />)
    expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument()
  })

  it("opens panel when FAB is clicked", () => {
    render(<ChatFab />)
    const fab = screen.getByRole("button", { name: /chat/i })
    fireEvent.click(fab)
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
  })

  it("closes panel when FAB is clicked again", () => {
    render(<ChatFab />)
    const fab = screen.getByRole("button", { name: /chat/i })
    fireEvent.click(fab)
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.click(fab)
    // Panel should be hidden (translated off-screen)
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-full")
  })

  it("closes panel on Escape key", () => {
    render(<ChatFab />)
    const fab = screen.getByRole("button", { name: /chat/i })
    fireEvent.click(fab)
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-full")
  })
})
