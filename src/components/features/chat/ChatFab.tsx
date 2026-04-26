import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/router"
import { useChat } from "@hooks/useChat"
import ChatPanel from "./ChatPanel"
import { getPageContext } from "./pageContext"

export default function ChatFab(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const router = useRouter()
  const pageContext = getPageContext(router.pathname)
  const routeParams = router.query
  const context = useMemo(() => {
    const ctx: Record<string, unknown> = {
      page: pageContext.page,
      description: pageContext.description,
    }
    // Include dynamic route params for specificity
    // e.g., /holdings/[code] -> code: "DBS"
    if (routeParams.code) ctx.portfolioCode = routeParams.code
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

  // Hide FAB on the /chat page — it's redundant there
  if (router.pathname === "/chat") return <></>

  return (
    <>
      {/* Slide-out panel */}
      <div
        data-testid="chat-panel-container"
        className={`fixed z-40 transition-all duration-300 ease-in-out ${
          isExpanded
            ? "bottom-6 right-6 w-[48rem] max-w-[calc(100vw-2rem)] h-[calc(100vh-5rem)]"
            : "bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[600px] max-h-[80vh]"
        } ${
          isOpen
            ? "translate-x-0"
            : "translate-x-[calc(100%+1.5rem)] pointer-events-none"
        }`}
      >
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onClear={clearMessages}
          onExpand={expand}
          placeholder={pageContext.placeholder}
          suggestions={pageContext.suggestions}
          className="h-full"
        />
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Chat"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-colors"
      >
        <i className={`fas ${isOpen ? "fa-times" : "fa-robot"} text-xl`}></i>
      </button>
    </>
  )
}
