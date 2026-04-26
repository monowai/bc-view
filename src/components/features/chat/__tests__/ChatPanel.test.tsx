import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import ChatPanel from "../ChatPanel"
import { ChatMessage } from "types/agent"

// react-markdown / remark-gfm mocked globally in jest.setup.js

describe("ChatPanel", () => {
  const defaultProps = {
    messages: [] as ChatMessage[],
    isLoading: false,
    onSend: jest.fn(),
    onClear: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders input field and send button", () => {
    render(<ChatPanel {...defaultProps} />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()
  })

  it("disables send button when input is empty", () => {
    render(<ChatPanel {...defaultProps} />)
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("disables send button when loading", () => {
    render(<ChatPanel {...defaultProps} isLoading={true} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "hello" } })
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
  })

  it("calls onSend when form is submitted", () => {
    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "show portfolios" } })
    fireEvent.submit(input.closest("form")!)
    expect(defaultProps.onSend).toHaveBeenCalledWith("show portfolios")
  })

  it("clears input after sending", () => {
    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText(
      "Ask about your portfolios...",
    ) as HTMLInputElement
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.submit(input.closest("form")!)
    expect(input.value).toBe("")
  })

  it("displays messages", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        timestamp: "2026-04-14T00:00:00Z",
      },
      {
        id: "2",
        role: "assistant",
        content: "Hi there!",
        timestamp: "2026-04-14T00:00:01Z",
      },
    ]
    render(<ChatPanel {...defaultProps} messages={messages} />)
    expect(screen.getByText("Hello")).toBeInTheDocument()
    expect(screen.getByText("Hi there!")).toBeInTheDocument()
  })

  it("shows loading indicator when isLoading", () => {
    render(<ChatPanel {...defaultProps} isLoading={true} />)
    expect(screen.getByText("Thinking...")).toBeInTheDocument()
  })

  it("Clear button is disabled with no messages and enabled with messages", () => {
    const onClear = jest.fn()
    const { rerender } = render(
      <ChatPanel {...defaultProps} onClear={onClear} />,
    )
    const clearBtn = screen.getByRole("button", { name: /clear chat/i })
    expect(clearBtn).toBeDisabled()
    fireEvent.click(clearBtn)
    expect(onClear).not.toHaveBeenCalled()

    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hi", timestamp: "t" },
    ]
    rerender(
      <ChatPanel {...defaultProps} onClear={onClear} messages={messages} />,
    )
    const enabled = screen.getByRole("button", { name: /clear chat/i })
    expect(enabled).not.toBeDisabled()
    fireEvent.click(enabled)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("renders Close icon only when onClose provided and calls it", () => {
    const onClose = jest.fn()
    const { rerender } = render(<ChatPanel {...defaultProps} />)
    expect(screen.queryByLabelText("Close chat")).not.toBeInTheDocument()

    rerender(<ChatPanel {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText("Close chat"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("renders the move icon and corner picker only when corner+onMove provided", () => {
    const { rerender } = render(<ChatPanel {...defaultProps} />)
    expect(screen.queryByLabelText("Move chat panel")).not.toBeInTheDocument()

    const onMove = jest.fn()
    rerender(<ChatPanel {...defaultProps} corner="BR" onMove={onMove} />)
    fireEvent.click(screen.getByLabelText("Move chat panel"))
    fireEvent.click(screen.getByLabelText("Top-left"))
    expect(onMove).toHaveBeenCalledWith("TL")
  })
})
