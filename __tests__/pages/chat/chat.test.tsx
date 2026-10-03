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
import { SIDEBAR_COLLAPSED_KEY } from "@components/features/chat/chatSidebar"
import { ConversationDetail, ConversationSummary } from "types/agent"

// svc-agent titles a new conversation in the background after its first
// answer; shrink the follow-up refresh delays so the test needn't wait.
jest.mock("@components/features/chat/chatSidebar", () => ({
  ...jest.requireActual("@components/features/chat/chatSidebar"),
  TITLE_REFRESH_DELAYS_MS: [30, 60],
}))

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
/** What svc-agent answers when the open conversation (c-1) is deleted. */
let deleteOpenStatus = 204
/** Titles svc-agent has accepted through a rename, by conversation id. */
let renamed: Record<string, string> = {}
/** Settles the next rename; a test may hold it to look at the saving state. */
let answerRename: (id: string, title: string) => Promise<unknown>

function routeFetch(): void {
  mockFetch = jest.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`
    switch (key) {
      case `GET ${LIST}`:
        return Promise.resolve(
          json({
            data: conversations.map((c) => ({
              ...c,
              title: renamed[c.id] ?? c.title,
            })),
          }),
        )
      case "GET /api/agent/conversations/c-1":
        return Promise.resolve(json({ data: detail }))
      case "DELETE /api/agent/conversations/c-2":
        return Promise.resolve({ ok: true, status: 204 })
      case "DELETE /api/agent/conversations/c-1":
        return Promise.resolve({
          ok: deleteOpenStatus < 400,
          status: deleteOpenStatus,
        })
      case "PATCH /api/agent/conversations/c-1":
      case "PATCH /api/agent/conversations/c-2": {
        const id = url.split("/").pop()!
        const { title } = JSON.parse(String(init?.body))
        return answerRename(id, title)
      }
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
    deleteOpenStatus = 204
    renamed = {}
    answerRename = (id, title) => {
      renamed[id] = title
      return Promise.resolve(json({ data: { ...detail, id, title } }))
    }
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

  async function deleteOpenConversation(): Promise<void> {
    renderPage()
    fireEvent.click(await within(sidebar()).findByText("NZD exposure"))
    await screen.findByText("About 40% of your wealth.")
    const listCallsBefore = callsTo("GET", LIST)

    fireEvent.click(
      within(sidebar()).getByRole("button", { name: 'Delete "NZD exposure"' }),
    )
    fireEvent.click(within(sidebar()).getByRole("button", { name: "Delete" }))

    await waitFor(() =>
      expect(callsTo("DELETE", "/api/agent/conversations/c-1")).toBe(1),
    )
    await waitFor(() =>
      expect(callsTo("GET", LIST)).toBeGreaterThan(listCallsBefore),
    )
  }

  it("resets the open chat once its conversation is deleted", async () => {
    await deleteOpenConversation()

    await waitFor(() =>
      expect(
        screen.queryByText("About 40% of your wealth."),
      ).not.toBeInTheDocument(),
    )
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull()
  })

  it("keeps the open chat when deleting its conversation fails", async () => {
    deleteOpenStatus = 500

    await deleteOpenConversation()

    expect(screen.getByText("About 40% of your wealth.")).toBeInTheDocument()
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe("c-1")
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

  describe("renaming a conversation", () => {
    const renameButton = (title: string): HTMLElement =>
      within(sidebar()).getByRole("button", { name: `Rename "${title}"` })
    const titleInput = (): HTMLInputElement =>
      within(sidebar()).getByRole("textbox", {
        name: /conversation title/i,
      }) as HTMLInputElement
    const patchesTo = (id: string): unknown[] =>
      mockFetch.mock.calls
        .filter(
          ([u, init]) =>
            u === `/api/agent/conversations/${id}` && init?.method === "PATCH",
        )
        .map(([, init]) => JSON.parse(String(init.body)))

    async function startRenaming(title = "Rebalance ideas"): Promise<void> {
      renderPage()
      await within(sidebar()).findByText(title)
      fireEvent.click(renameButton(title))
    }

    it("edits the title inline, pre-filled, focused and selected", async () => {
      await startRenaming()

      const input = titleInput()
      expect(input).toHaveValue("Rebalance ideas")
      expect(input).toHaveFocus()
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe("Rebalance ideas".length)
      expect(input).toHaveAttribute("maxLength", "60")
    })

    it("saves on Enter, trimmed, then refreshes the list", async () => {
      await startRenaming()
      const listCallsBefore = callsTo("GET", LIST)

      fireEvent.change(titleInput(), { target: { value: "  Hedging plan  " } })
      fireEvent.keyDown(titleInput(), { key: "Enter" })

      await waitFor(() =>
        expect(patchesTo("c-2")).toEqual([{ title: "Hedging plan" }]),
      )
      await waitFor(() =>
        expect(callsTo("GET", LIST)).toBeGreaterThan(listCallsBefore),
      )
      expect(await screen.findByText("Hedging plan")).toBeInTheDocument()
      expect(renameButton("Hedging plan")).toBeInTheDocument()
      expect(
        within(sidebar()).queryByRole("textbox", {
          name: /conversation title/i,
        }),
      ).not.toBeInTheDocument()
    })

    it("saves when the input loses focus", async () => {
      await startRenaming()

      fireEvent.change(titleInput(), { target: { value: "Hedging plan" } })
      fireEvent.blur(titleInput())

      await waitFor(() =>
        expect(patchesTo("c-2")).toEqual([{ title: "Hedging plan" }]),
      )
      expect(await screen.findByText("Hedging plan")).toBeInTheDocument()
    })

    it("cancels on Escape without saving", async () => {
      await startRenaming()

      fireEvent.change(titleInput(), { target: { value: "Hedging plan" } })
      fireEvent.keyDown(titleInput(), { key: "Escape" })

      expect(within(sidebar()).getByText("Rebalance ideas")).toBeInTheDocument()
      expect(screen.queryByText("Hedging plan")).not.toBeInTheDocument()
      expect(patchesTo("c-2")).toEqual([])
    })

    it("does not save a blank title", async () => {
      await startRenaming()

      fireEvent.change(titleInput(), { target: { value: "   " } })
      fireEvent.keyDown(titleInput(), { key: "Enter" })

      expect(within(sidebar()).getByText("Rebalance ideas")).toBeInTheDocument()
      expect(patchesTo("c-2")).toEqual([])
    })

    it("shows the new title while saving and reverts with an inline error on failure", async () => {
      const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {})
      let fail: () => void = () => {}
      answerRename = () =>
        new Promise((resolve) => {
          fail = () => resolve(json({ message: "boom" }, 500))
        })
      await startRenaming()

      fireEvent.change(titleInput(), { target: { value: "Hedging plan" } })
      fireEvent.keyDown(titleInput(), { key: "Enter" })

      expect(within(sidebar()).getByText("Hedging plan")).toBeInTheDocument()
      fail()

      expect(
        await within(sidebar()).findByText("Rebalance ideas"),
      ).toBeInTheDocument()
      expect(within(sidebar()).getByRole("alert")).toHaveTextContent(
        /couldn.t rename/i,
      )
      expect(screen.queryByText("Hedging plan")).not.toBeInTheDocument()
      expect(alertSpy).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })

    it("edits one row at a time", async () => {
      await startRenaming("NZD exposure")

      fireEvent.click(renameButton("Rebalance ideas"))

      expect(
        within(sidebar()).getAllByRole("textbox", {
          name: /conversation title/i,
        }),
      ).toHaveLength(1)
      expect(titleInput()).toHaveValue("Rebalance ideas")
      expect(within(sidebar()).getByText("NZD exposure")).toBeInTheDocument()
    })

    it("drops a pending delete confirmation when renaming starts", async () => {
      renderPage()
      await within(sidebar()).findByText("Rebalance ideas")
      fireEvent.click(
        within(sidebar()).getByRole("button", {
          name: 'Delete "Rebalance ideas"',
        }),
      )

      fireEvent.click(renameButton("NZD exposure"))

      expect(
        within(sidebar()).queryByRole("button", { name: "Delete" }),
      ).not.toBeInTheDocument()
      expect(titleInput()).toHaveValue("NZD exposure")
    })

    it("enters rename mode on a double-click of the title", async () => {
      renderPage()
      const title = await within(sidebar()).findByText("Rebalance ideas")

      fireEvent.doubleClick(title)

      expect(titleInput()).toHaveValue("Rebalance ideas")
    })
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

  it("looks again for a new conversation's generated title after its first answer", async () => {
    renderPage()
    await within(sidebar()).findByText("NZD exposure")
    const listCallsBefore = callsTo("GET", LIST)

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "How am I tracking?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    expect(await screen.findByText("Here you go")).toBeInTheDocument()
    // Once on completion, then once per follow-up delay.
    await waitFor(() =>
      expect(callsTo("GET", LIST)).toBeGreaterThanOrEqual(listCallsBefore + 3),
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

  describe("collapsible sidebar", () => {
    const originalMatchMedia = window.matchMedia

    // jsdom has no matchMedia; the page treats that as a desktop viewport.
    function viewport(wide: boolean): void {
      window.matchMedia = jest.fn((query: string) => ({
        matches: wide,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })) as unknown as typeof window.matchMedia
    }

    afterEach(() => {
      window.matchMedia = originalMatchMedia
    })

    const queryNav = (): HTMLElement | null =>
      screen.queryByRole("navigation", { name: /conversations/i })

    it("hides and shows the conversations, remembering the choice", async () => {
      renderPage()
      await within(sidebar()).findByText("NZD exposure")

      const hide = screen.getByRole("button", { name: "Hide conversations" })
      expect(hide).toHaveAttribute("aria-expanded", "true")
      fireEvent.click(hide)

      expect(queryNav()).not.toBeInTheDocument()
      const show = screen.getByRole("button", { name: "Show conversations" })
      expect(show).toHaveAttribute("aria-expanded", "false")
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true")

      fireEvent.click(show)

      expect(await within(sidebar()).findByText("NZD exposure")).toBeVisible()
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("false")
    })

    it("restores a collapsed sidebar on the next visit", async () => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true")
      renderPage()

      expect(
        await screen.findByRole("button", { name: "Show conversations" }),
      ).toBeInTheDocument()
      expect(queryNav()).not.toBeInTheDocument()
    })

    it("starts a new chat from the collapsed rail", async () => {
      renderPage()
      fireEvent.click(await within(sidebar()).findByText("NZD exposure"))
      await screen.findByText("About 40% of your wealth.")
      fireEvent.click(
        screen.getByRole("button", { name: "Hide conversations" }),
      )
      const rail = screen.getByRole("button", {
        name: "Show conversations",
      }).parentElement!

      fireEvent.click(within(rail).getByRole("button", { name: "New chat" }))

      expect(
        screen.queryByText("About 40% of your wealth."),
      ).not.toBeInTheDocument()
      expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBeNull()
    })

    it("starts expanded on a wide screen", async () => {
      viewport(true)
      renderPage()

      expect(await within(sidebar()).findByText("NZD exposure")).toBeVisible()
    })

    it("starts collapsed on a narrow screen", async () => {
      viewport(false)
      renderPage()

      expect(
        await screen.findByRole("button", { name: "Show conversations" }),
      ).toBeInTheDocument()
      expect(queryNav()).not.toBeInTheDocument()
    })

    it("lets a stored choice override the narrow-screen default", async () => {
      viewport(false)
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false")
      renderPage()

      expect(await within(sidebar()).findByText("NZD exposure")).toBeVisible()
    })

    it("closes the overlay after picking a conversation on a narrow screen", async () => {
      viewport(false)
      renderPage()
      fireEvent.click(
        await screen.findByRole("button", { name: "Show conversations" }),
      )

      fireEvent.click(await within(sidebar()).findByText("NZD exposure"))

      expect(
        await screen.findByText("About 40% of your wealth."),
      ).toBeInTheDocument()
      expect(queryNav()).not.toBeInTheDocument()
      // Closing the overlay is not a preference change.
      expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("false")
    })

    it("keeps the overlay open while renaming on a narrow screen", async () => {
      viewport(false)
      renderPage()
      fireEvent.click(
        await screen.findByRole("button", { name: "Show conversations" }),
      )
      await within(sidebar()).findByText("Rebalance ideas")

      fireEvent.click(
        within(sidebar()).getByRole("button", {
          name: 'Rename "Rebalance ideas"',
        }),
      )
      const input = within(sidebar()).getByRole("textbox", {
        name: /conversation title/i,
      })
      fireEvent.change(input, { target: { value: "Hedging plan" } })
      fireEvent.keyDown(input, { key: "Enter" })

      expect(
        await within(sidebar()).findByText("Hedging plan"),
      ).toBeInTheDocument()
      expect(sidebar()).toBeInTheDocument()
    })

    it("keeps the sidebar open after picking a conversation on a wide screen", async () => {
      viewport(true)
      renderPage()

      fireEvent.click(await within(sidebar()).findByText("NZD exposure"))

      expect(
        await screen.findByText("About 40% of your wealth."),
      ).toBeInTheDocument()
      expect(sidebar()).toBeInTheDocument()
    })
  })
})
