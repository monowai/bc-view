import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatBubble from "../ChatBubble"
import { ChatMessage } from "types/agent"

// react-markdown / remark-gfm mocked globally in jest.setup.js

describe("ChatBubble", () => {
  const userMessage: ChatMessage = {
    id: "1",
    role: "user",
    content: "Show my portfolios",
    timestamp: "2026-04-14T00:00:00Z",
  }

  const assistantMessage: ChatMessage = {
    id: "2",
    role: "assistant",
    content: "Here are your **portfolios**:\n- TYLER\n- DBS",
    timestamp: "2026-04-14T00:00:01Z",
  }

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    })
  })

  it("renders user message as plain text", () => {
    render(<ChatBubble message={userMessage} />)
    expect(screen.getByText("Show my portfolios")).toBeInTheDocument()
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument()
  })

  it("shows copy and retry buttons on user messages when onRetry provided", () => {
    render(<ChatBubble message={userMessage} onRetry={jest.fn()} />)
    expect(screen.getByLabelText("Copy message")).toBeInTheDocument()
    expect(screen.getByLabelText("Retry message")).toBeInTheDocument()
  })

  it("retry button re-sends the user message preserving deepThink state", () => {
    const onRetry = jest.fn()
    render(<ChatBubble message={userMessage} onRetry={onRetry} />)
    fireEvent.click(screen.getByLabelText("Retry message"))
    // userMessage has no deepThink → forwarded as false
    expect(onRetry).toHaveBeenCalledWith("Show my portfolios", false)
  })

  it("retry preserves deepThink=true when the original message had it", () => {
    const onRetry = jest.fn()
    render(
      <ChatBubble
        message={{ ...userMessage, deepThink: true }}
        onRetry={onRetry}
      />,
    )
    fireEvent.click(screen.getByLabelText("Retry message"))
    expect(onRetry).toHaveBeenCalledWith("Show my portfolios", true)
  })

  it("renders a deep-think badge on user messages with deepThink=true", () => {
    render(
      <ChatBubble
        message={{ ...userMessage, deepThink: true }}
        onRetry={jest.fn()}
      />,
    )
    expect(screen.getByText(/deep/i)).toBeInTheDocument()
  })

  it("copies user message content to clipboard", async () => {
    render(<ChatBubble message={userMessage} onRetry={jest.fn()} />)
    fireEvent.click(screen.getByLabelText("Copy message"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        userMessage.content,
      )
    })
  })

  it("renders assistant message with markdown", () => {
    render(<ChatBubble message={assistantMessage} />)
    expect(screen.getByTestId("markdown")).toBeInTheDocument()
  })

  it("shows copy button on assistant messages", () => {
    render(<ChatBubble message={assistantMessage} />)
    expect(screen.getByLabelText("Copy message")).toBeInTheDocument()
  })

  it("copies message content to clipboard on click", async () => {
    render(<ChatBubble message={assistantMessage} />)
    fireEvent.click(screen.getByLabelText("Copy message"))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        assistantMessage.content,
      )
    })
  })

  it("renders error indicator for assistant errors", () => {
    const errorMessage: ChatMessage = {
      ...assistantMessage,
      error: "Service unavailable",
    }
    render(<ChatBubble message={errorMessage} />)
    expect(screen.getByTestId("markdown")).toBeInTheDocument()
  })
})
