import React from "react"
import { render, screen } from "@testing-library/react"
import ChatBubble from "../ChatBubble"
import { ChatMessage } from "types/agent"

// Mock react-markdown to avoid ESM issues in Jest
jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})

jest.mock("remark-gfm", () => () => {})

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

  it("renders user message as plain text", () => {
    render(<ChatBubble message={userMessage} />)
    expect(screen.getByText("Show my portfolios")).toBeInTheDocument()
    expect(screen.queryByTestId("markdown")).not.toBeInTheDocument()
  })

  it("renders assistant message with markdown", () => {
    render(<ChatBubble message={assistantMessage} />)
    expect(screen.getByTestId("markdown")).toBeInTheDocument()
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
