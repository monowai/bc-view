import React from "react"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import { SWRConfig } from "swr"
import ChatPage from "@pages/chat"
import ChatFab from "@components/features/chat/ChatFab"
import { ChatProvider } from "@components/features/chat/ChatProvider"
import { CONVERSATION_STORAGE_KEY } from "@hooks/useChat"
import { ConversationDetail, ConversationSummary } from "types/agent"

// next/router, next/link, react-markdown and the Auth0 client are mocked
// globally in jest.setup.js (pathname "" — so the FAB is visible too).

const LIST = "/api/agent/conversations?page=0&size=30"
const STREAM = "/api/agent/query/stream"

const now = new Date()
const minutesAgo = (m: number): string =>
  new Date(now.getTime() - m * 60_000).toISOString()

const conversations: ConversationSummary[] = [
  {
    id: "c-1",
    title: "NZD exposure",
    createdAt: minutesAgo(90),
    updatedAt: minutesAgo(5),
  },
  {
    id: "c-2",
    title: "Rebalance ideas",
    createdAt: minutesAgo(300),
    updatedAt: minutesAgo(180),
  },
]

const detail: ConversationDetail = {
  ...conversations[0],
  messages: [
    {
      id: "t1",
      role: "user",
      content: "What is my NZD exposure?",
      timestamp: minutesAgo(6),
      error: null,
      deepThink: false,
    },
    {
      id: "t2",
      role: "assistant",
      content: "About 40% of your wealth.",
      timestamp: minutesAgo(5),
      error: null,
      deepThink: false,
    },
  ],
}

function json(body: unknown, status = 200): unknown {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  }
}

function sseResponse(text: string): unknown {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(
        encoder.encode(`event:token\ndata:${text}\n\nevent:done\ndata:{}\n\n`),
      )
      c.close()
    },
  })
  return { ok: true, status: 200, body }
}

let mockFetch: jest.Mock

function routeFetch(): void {
  mockFetch = jest.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`
    switch (key) {
      case `GET ${LIST}`:
        return Promise.resolve(json({ data: conversations }))
      case "GET /api/agent/conversations/c-1":
        return Promise.resolve(json({ data: detail }))
      case "DELETE /api/agent/conversations/c-2":
        return Promise.resolve({ ok: true, status: 204 })
      case "POST /api/agent/conversations":
        return Promise.resolve(json({ data: { id: "c-new" } }, 201))
      case `POST ${STREAM}`:
        return Promise.resolve(sseResponse("Here you go"))
      default:
        return Promise.resolve(json({ data: [] }))
    }
  })
  global.fetch = mockFetch
}

const callsTo = (method: string, url: string): number =>
  mockFetch.mock.calls.filter(
    ([u, init]) => u === url && (init?.method ?? "GET") === method,
  ).length

function renderPage(withFab = false): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ChatProvider>
        {withFab && <ChatFab />}
        <ChatPage />
      </ChatProvider>
    </SWRConfig>,
  )
}

const sidebar = (): HTMLElement =>
  screen.getByRole("navigation", { name: /conversations/i })

describe("/chat page", () => {
  beforeEach(() => {
    localStorage.clear()
    routeFetch()
  })

  it("lists past conversations with when they were last active", async () => {
    renderPage()

    const nav = sidebar()
    expect(await within(nav).findByText("NZD exposure")).toBeInTheDocument()
    expect(within(nav).getByText("Rebalance ideas")).toBeInTheDocument()
    expect(within(nav).getByText("5m ago")).toBeInTheDocument()
    expect(within(nav).getByText("3h ago")).toBeInTheDocument()
  })

  it("opens a conversation when it is clicked and marks it active", async () => {
    renderPage()

    fireEvent.click(await within(sidebar()).findByText("NZD exposure"))

    expect(
      await screen.findByText("About 40% of your wealth."),
    ).toBeInTheDocument()
    expect(
      within(sidebar()).getByRole("button", { name: /^NZD exposure/ }),
    ).toHaveAttribute("aria-current", "true")
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-1")
  })

  it("deletes a conversation only after an inline confirm, then refreshes the list", async () => {
    const confirmSpy = jest.spyOn(window, "confirm")
    renderPage()
    await within(sidebar()).findByText("Rebalance ideas")
    const listCallsBefore = callsTo("GET", LIST)

    fireEvent.click(
      within(sidebar()).getByRole("button", {
        name: 'Delete "Rebalance ideas"',
      }),
    )
    expect(callsTo("DELETE", "/api/agent/conversations/c-2")).toBe(0)

    fireEvent.click(within(sidebar()).getByRole("button", { name: "Delete" }))

    await waitFor(() =>
      expect(callsTo("DELETE", "/api/agent/conversations/c-2")).toBe(1),
    )
    await waitFor(() =>
      expect(callsTo("GET", LIST)).toBeGreaterThan(listCallsBefore),
    )
    expect(confirmSpy).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it("keeps the conversation when the delete is cancelled", async () => {
    renderPage()
    await within(sidebar()).findByText("Rebalance ideas")

    fireEvent.click(
      within(sidebar()).getByRole("button", {
        name: 'Delete "Rebalance ideas"',
      }),
    )
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Keep" }))

    expect(callsTo("DELETE", "/api/agent/conversations/c-2")).toBe(0)
    expect(
      within(sidebar()).getByRole("button", {
        name: 'Delete "Rebalance ideas"',
      }),
    ).toBeInTheDocument()
  })

  it("starts a new chat from the sidebar", async () => {
    renderPage()
    fireEvent.click(await within(sidebar()).findByText("NZD exposure"))
    await screen.findByText("About 40% of your wealth.")

    fireEvent.click(
      within(sidebar()).getByRole("button", { name: /new chat/i }),
    )

    expect(
      screen.queryByText("About 40% of your wealth."),
    ).not.toBeInTheDocument()
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull()
  })

  it("refreshes the list once a send completes", async () => {
    renderPage()
    await within(sidebar()).findByText("NZD exposure")
    const listCallsBefore = callsTo("GET", LIST)

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "How am I tracking?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    expect(await screen.findByText("Here you go")).toBeInTheDocument()
    await waitFor(() =>
      expect(callsTo("GET", LIST)).toBeGreaterThan(listCallsBefore),
    )
  })

  it("shares one conversation with the Chat FAB", async () => {
    renderPage(true)
    await within(sidebar()).findByText("NZD exposure")

    fireEvent.click(screen.getByLabelText("Chat"))
    const fab = screen.getByTestId("chat-panel-container")
    fireEvent.change(within(fab).getByRole("textbox"), {
      target: { value: "Asked in the FAB" },
    })
    fireEvent.submit(within(fab).getByRole("textbox").closest("form")!)

    // Shown in both the FAB panel and the /chat page panel.
    await waitFor(() =>
      expect(screen.getAllByText("Asked in the FAB")).toHaveLength(2),
    )
    await waitFor(() =>
      expect(screen.getAllByText("Here you go")).toHaveLength(2),
    )
  })
})
