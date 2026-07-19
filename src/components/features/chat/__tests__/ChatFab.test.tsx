import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ChatFab from "../ChatFab"
import { setPageContext } from "../pageContextBus"

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
    // pageContextBus retains its last-published value across renders (by
    // design — see its module doc) so a leftover from another test/page
    // would otherwise leak in here.
    setPageContext(null)
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

  // --- Live page-context injection (pageContextBus) ---

  it("includes a page's published context as context.currentState in the outgoing query payload", () => {
    setPageContext("DRAFT rebalance: AAPL 20% -> 30%")
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "does this trade make sense?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/agent/query/stream",
      expect.objectContaining({
        body: expect.stringContaining(
          '"currentState":"DRAFT rebalance: AAPL 20% -> 30%"',
        ),
      }),
    )
  })

  it("omits context.currentState from the outgoing payload when nothing has been published", () => {
    render(<ChatFab />)
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "show my portfolios" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    const call = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.context).not.toHaveProperty("currentState")
  })

  it("picks up a context published AFTER mount (subscribe delivers the retained current value, and later updates arrive live)", () => {
    render(<ChatFab />)
    // Published after ChatFab has already mounted/subscribed.
    setPageContext("DRAFT rebalance: cash short by 200.00")
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "what's the cash situation?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    const call = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(call[1].body)
    expect(body.context.currentState).toBe(
      "DRAFT rebalance: cash short by 200.00",
    )
  })
})
