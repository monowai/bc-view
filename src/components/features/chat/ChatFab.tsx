import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/router"
import { useChat } from "@hooks/useChat"
import { usePermissions } from "@hooks/usePermissions"
import ChatPanel from "./ChatPanel"
import { getPageContext } from "./pageContext"
import {
  CORNER_LAYOUT,
  ChatCorner,
  loadChatCorner,
  saveChatCorner,
} from "@components/features/chat/chatPosition"

export default function ChatFab(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [corner, setCornerState] = useState<ChatCorner>("BR")
  // Hydrate from localStorage post-mount to avoid SSR/CSR mismatch.
  useEffect(() => setCornerState(loadChatCorner()), [])
  const setCorner = useCallback((next: ChatCorner) => {
    setCornerState(next)
    saveChatCorner(next)
  }, [])
  const layout = CORNER_LAYOUT[corner]
  const router = useRouter()
  const pageContext = getPageContext(router.pathname)
  const routeParams = router.query
  const context = useMemo(() => {
    const ctx: Record<string, unknown> = {
      page: pageContext.page,
      description: pageContext.description,
    }
    // Include dynamic route params for specificity. Managed (shared)
    // portfolios are routed as /holdings/{portfolio.id}?byId=1 — in that
    // case the dynamic [code] segment is actually the portfolio id, so
    // expose it as portfolioId for the agent's by-id tools rather than
    // the by-code ones (which 404 for shared portfolios).
    if (routeParams.code) {
      if (routeParams.byId === "1") {
        ctx.portfolioId = routeParams.code
      } else {
        ctx.portfolioCode = routeParams.code
      }
    }
    if (routeParams.id) ctx.entityId = routeParams.id
    if (routeParams.modelId) ctx.modelId = routeParams.modelId
    return ctx
  }, [pageContext.page, pageContext.description, routeParams])
  const { messages, isLoading, sendMessage, clearMessages } = useChat(context)

  const close = useCallback(() => {
    setIsOpen(false)
    setIsExpanded(false)
  }, [])

  const expand = useCallback((): void => {
    setIsExpanded((prev) => !prev)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && isOpen) {
        close()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, close])

  const { ai: canRunAi, isLoading: permsLoading } = usePermissions()

  // Hide FAB on the /chat page — it's redundant there
  if (router.pathname === "/chat") return <></>
  // Hide entirely until permissions resolve, then only render if user has AI access.
  if (permsLoading || !canRunAi) return <></>

  return (
    <>
      {/* Slide-out panel */}
      <div
        data-testid="chat-panel-container"
        className={`fixed z-40 transition-all duration-300 ease-in-out ${
          isExpanded
            ? `${layout.panelExpanded} w-[48rem] max-w-[calc(100vw-2rem)] h-[calc(100vh-5rem)]`
            : `${layout.panel} w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh]`
        } ${
          isOpen
            ? "translate-x-0"
            : `${layout.hiddenTransform} pointer-events-none`
        }`}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onClear={clearMessages}
          onExpand={expand}
          onClose={close}
          placeholder={pageContext.placeholder}
          suggestions={pageContext.suggestions}
          corner={corner}
          onMove={setCorner}
          className="h-full"
        />
      </div>

      {/* FAB button — only when closed; the in-panel header X handles closing. */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Chat"
          className={`fixed ${layout.fab} z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors`}
        >
          <i className="fas fa-robot text-xl"></i>
        </button>
      )}
    </>
  )
}
