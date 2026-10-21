import React from "react"
import { render, screen, within } from "@testing-library/react"
import ConversationList from "../ConversationList"
import { ConversationSummary } from "types/agent"

function summary(
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id: "c-1",
    title: "A conversation",
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
    ...overrides,
  }
}

function renderList(conversations: ConversationSummary[]): void {
  render(
    <ConversationList
      conversations={conversations}
      activeId={null}
      onSelect={jest.fn()}
      onDelete={jest.fn()}
      onRename={jest.fn().mockResolvedValue(undefined)}
      onNewChat={jest.fn()}
    />,
  )
}

const rowOf = (title: string): HTMLElement =>
  screen.getByText(title).closest("li") as HTMLElement

describe("ConversationList kind badge", () => {
  it("marks a Holding Analysis and an Asset Review", () => {
    renderList([
      summary({ id: "h", title: "Mine", kind: "HOLDING_ANALYSIS" }),
      summary({ id: "a", title: "Theirs", kind: "ASSET_REVIEW" }),
    ])
    expect(within(rowOf("Mine")).getByText("Holding")).toBeInTheDocument()
    expect(within(rowOf("Theirs")).getByText("Review")).toBeInTheDocument()
  })

  it("leaves a plain chat, or one with no kind, unbadged", () => {
    renderList([
      summary({ id: "c", title: "Chat", kind: "CHAT" }),
      summary({ id: "o", title: "Old" }),
    ])
    for (const title of ["Chat", "Old"]) {
      const row = within(rowOf(title))
      expect(row.queryByText("Holding")).not.toBeInTheDocument()
      expect(row.queryByText("Review")).not.toBeInTheDocument()
    }
  })
})
