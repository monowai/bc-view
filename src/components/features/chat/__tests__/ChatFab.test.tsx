import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatFab from "../ChatFab"
import { ChatProvider } from "../ChatProvider"
import { act } from "@testing-library/react"
import { setPageContext } from "../pageContextBus"
import { requestChatOpen } from "../chatBus"
import { ChatMessage } from "types/agent"

// react-markdown / remark-gfm mocked globally in jest.setup.js

const mockPush = jest.fn()
let mockPathname = "/wealth"
jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: mockPathname, query: {}, push: mockPush }),
}))

// Mock fetch for useChat
global.fetch = jest.fn()

const STREAM = "/api/agent/query/stream"

function renderFab(): ReturnType<typeof render> {
  return render(
    <ChatProvider>
      <ChatFab />
    </ChatProvider>,
  )
}

/** Body of the latest stream request, once the (async) send has issued it. */
async function lastStreamBody(): Promise<Record<string, any>> {
  let body: Record<string, any> | undefined
  await waitFor(() => {
    const calls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === STREAM,
    )
    expect(calls.length).toBeGreaterThan(0)
    body = JSON.parse(calls[calls.length - 1][1].body)
  })
  return body!
}

describe("ChatFab", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPathname = "/wealth"
    window.localStorage.removeItem("bc-chat-corner")
    // pageContextBus retains its last-published value across renders (by
    // design — see its module doc) so a leftover from another test/page
    // would otherwise leak in here.
    setPageContext(null)
  })

  it("renders the FAB button", () => {
    renderFab()
    expect(screen.getByLabelText("Chat")).toBeInTheDocument()
  })

  it("opens panel when FAB is clicked", () => {
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
  })

  it("FAB unmounts while the panel is open and the header Close X dismisses it", () => {
    renderFab()
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
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByText("Holdsworth Assistant")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("translate-x-[calc(100%+1.5rem)]")
    expect(panel.className).toContain("pointer-events-none")
  })

  it("expand button toggles expanded panel size", () => {
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))
    const panel = screen.getByTestId("chat-panel-container")
    expect(panel.className).toContain("w-[60vw]")

    fireEvent.click(screen.getByLabelText("Expand chat"))
    expect(panel.className).toContain("w-[80vw]")
    expect(mockPush).not.toHaveBeenCalled()

    // Toggle back to compact
    fireEvent.click(screen.getByLabelText("Expand chat"))
    expect(panel.className).toContain("w-[60vw]")
  })

  it("links to the full chat history", () => {
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))
    expect(screen.getByRole("link", { name: /history/i })).toHaveAttribute(
      "href",
      "/chat",
    )
  })

  // --- Live page-context injection (pageContextBus) ---

  it("includes a page's published context as context.currentState in the outgoing query payload", async () => {
    setPageContext("DRAFT rebalance: AAPL 20% -> 30%")
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "does this trade make sense?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    const body = await lastStreamBody()
    expect(body.context.currentState).toBe("DRAFT rebalance: AAPL 20% -> 30%")
  })

  it("omits context.currentState from the outgoing payload when nothing has been published", async () => {
    renderFab()
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "show my portfolios" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    const body = await lastStreamBody()
    expect(body.context).not.toHaveProperty("currentState")
  })

  it("picks up a context published AFTER mount (subscribe delivers the retained current value, and later updates arrive live)", async () => {
    renderFab()
    // Published after ChatFab has already mounted/subscribed.
    setPageContext("DRAFT rebalance: cash short by 200.00")
    fireEvent.click(screen.getByLabelText("Chat"))

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "what's the cash situation?" },
    })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)

    const body = await lastStreamBody()
    expect(body.context.currentState).toBe(
      "DRAFT rebalance: cash short by 200.00",
    )
  })

  describe("Quick Analysis hand-off", () => {
    const transcript: ChatMessage[] = [
      {
        id: "u1",
        role: "user",
        content: "Produce an Asset Review for AAPL. Cover company context.",
        label: "Asset Review — AAPL",
        timestamp: "2026-10-02T00:00:00Z",
      },
      {
        id: "a1",
        role: "assistant",
        content: "AAPL looks Bullish",
        timestamp: "2026-10-02T00:00:01Z",
      },
    ]
    const analysisContext = { page: "Asset Review", tickers: "AAPL" }

    const handOff = (): void => {
      act(() => requestChatOpen({ transcript, context: analysisContext }))
    }

    interface QueryBody {
      context: Record<string, unknown>
      history?: unknown
    }

    const ask = async (question: string): Promise<QueryBody> => {
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: question },
      })
      fireEvent.submit(screen.getByRole("textbox").closest("form")!)
      return (await lastStreamBody()) as QueryBody
    }

    it("closes when /chat takes over, so leaving /chat shows only the FAB with the conversation intact", () => {
      const fab = (): React.ReactElement => (
        <ChatProvider>
          <ChatFab />
        </ChatProvider>
      )
      const { rerender } = render(fab())
      handOff()
      fireEvent.click(screen.getByLabelText("Expand chat"))
      expect(screen.getByTestId("chat-panel-container").className).toContain(
        "w-[80vw]",
      )

      mockPathname = "/chat"
      rerender(fab())
      expect(
        screen.queryByTestId("chat-panel-container"),
      ).not.toBeInTheDocument()

      mockPathname = "/wealth"
      rerender(fab())
      const panel = screen.getByTestId("chat-panel-container")
      expect(panel.className).toContain("pointer-events-none")
      expect(panel.className).toContain("w-[60vw]")
      expect(screen.getByLabelText("Chat")).toBeInTheDocument()

      fireEvent.click(screen.getByLabelText("Chat"))
      expect(screen.getByText("AAPL looks Bullish")).toBeInTheDocument()
    })

    it("opens with the handed-off thread, showing the label instead of the canned prompt", () => {
      renderFab()
      handOff()

      expect(screen.getByText("Asset Review — AAPL")).toBeInTheDocument()
      expect(screen.getByText("AAPL looks Bullish")).toBeInTheDocument()
      expect(
        screen.queryByText(/Produce an Asset Review/),
      ).not.toBeInTheDocument()
    })

    it("sends follow-ups with the analysis context and the thread as history", async () => {
      renderFab()
      handOff()

      const body = await ask("How exposed is it to China?")

      expect(body.context).toEqual(analysisContext)
      expect(body.history).toEqual([
        { role: "user", content: transcript[0].content },
        { role: "assistant", content: "AAPL looks Bullish" },
      ])
    })

    it("returns to the page's own context once a new chat is started", async () => {
      renderFab()
      handOff()

      fireEvent.click(screen.getByRole("button", { name: /new chat/i }))
      const body = await ask("show my portfolios")

      expect(body.context.page).not.toBe("Asset Review")
      expect(body.context).not.toHaveProperty("tickers")
    })
  })
})
