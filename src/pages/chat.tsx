import React, { useCallback, useEffect, useRef, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import useSwr from "swr"
import { ChatPanel } from "@components/features/chat"
import ConversationList, {
  ConversationRail,
} from "@components/features/chat/ConversationList"
import {
  isNarrowViewport,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
  TITLE_REFRESH_DELAYS_MS,
} from "@components/features/chat/chatSidebar"
import { useSharedChat } from "@components/features/chat/ChatProvider"
import { fetcher } from "@utils/api/fetchHelper"
import { ConversationSummary } from "types/agent"

const CONVERSATIONS_KEY = "/api/agent/conversations?page=0&size=30"

function ChatPage(): React.ReactElement {
  // Same chat as the FAB — a conversation started there continues here.
  const {
    messages,
    isLoading,
    sendMessage,
    newChat,
    cancel,
    conversationId,
    loadConversation,
  } = useSharedChat()
  const {
    data,
    isLoading: listLoading,
    mutate,
  } = useSwr<{ data: ConversationSummary[] }>(CONVERSATIONS_KEY, fetcher)
  // null until mounted: the server can't know the viewport or the stored
  // choice, so the first render leans on CSS breakpoints alone.
  const [collapsed, setCollapsed] = useState<boolean | null>(null)
  // Hydrate post-mount to avoid an SSR/CSR mismatch (same as ChatFab's corner).
  useEffect(
    // eslint-disable-next-line react-hooks/set-state-in-effect
    () => setCollapsed(loadSidebarCollapsed() ?? isNarrowViewport()),
    [],
  )

  const toggleSidebar = useCallback((next: boolean) => {
    setCollapsed(next)
    saveSidebarCollapsed(next)
  }, [])

  // On a phone the open list overlays the chat; get it out of the way once
  // the viewer has picked something. Not a preference change, so not saved.
  const dismissOverlay = useCallback(() => {
    if (isNarrowViewport()) setCollapsed(true)
  }, [])

  // A finished send creates or bumps a conversation — refresh the list. The
  // first answer of a new conversation also gets a model-written title a
  // moment later, so look again for it.
  const wasLoading = useRef(isLoading)
  const messageCount = useRef(messages.length)
  useEffect(() => {
    messageCount.current = messages.length
  }, [messages.length])
  useEffect(() => {
    const finished = wasLoading.current && !isLoading
    wasLoading.current = isLoading
    if (!finished) return undefined
    void mutate()
    if (messageCount.current > 2) return undefined
    const timers = TITLE_REFRESH_DELAYS_MS.map((ms) =>
      setTimeout(() => void mutate(), ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [isLoading, mutate])

  // Picking the open conversation doesn't reload it: a reload would cancel
  // an answer in flight, and a double-click (to rename) clicks twice.
  const select = useCallback(
    (id: string) => {
      dismissOverlay()
      if (id !== conversationId) void loadConversation(id)
    },
    [conversationId, dismissOverlay, loadConversation],
  )

  const startNewChat = useCallback(() => {
    dismissOverlay()
    newChat()
  }, [dismissOverlay, newChat])

  const remove = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/agent/conversations/${encodeURIComponent(id)}`,
          { method: "DELETE" },
        )
        // Only a delete that took leaves the open chat with nothing behind it.
        if (res.ok && id === conversationId) newChat()
      } catch {
        // Network failure — keep the chat; the list below shows what survived.
      }
      void mutate()
    },
    [conversationId, newChat, mutate],
  )

  // Not an overlay-dismissing pick: the viewer stays in the list.
  const rename = useCallback(
    async (id: string, title: string) => {
      const res = await fetch(
        `/api/agent/conversations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      )
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`)
      await mutate()
    },
    [mutate],
  )

  return (
    <>
      <Head>
        <title>Chat - Holdsworth</title>
      </Head>
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-6xl flex-col gap-2 px-2 sm:px-1 md:px-0">
        <div className="relative flex min-h-0 flex-1 gap-3">
          {collapsed !== false && (
            <ConversationRail
              onExpand={() => toggleSidebar(false)}
              onNewChat={startNewChat}
              className={collapsed ? "flex" : "flex md:hidden"}
            />
          )}
          {collapsed !== true && (
            <ConversationList
              conversations={data?.data ?? []}
              activeId={conversationId}
              isLoading={listLoading}
              onSelect={select}
              onDelete={(id) => void remove(id)}
              onRename={rename}
              onNewChat={startNewChat}
              onCollapse={() => toggleSidebar(true)}
              className={`${
                collapsed === false ? "flex" : "hidden md:flex"
              } absolute inset-y-0 left-0 z-10 w-full max-w-xs md:static md:w-64 md:shrink-0`}
            />
          )}
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={(query, deepThink, think) =>
              sendMessage(query, deepThink, think)
            }
            onNewChat={startNewChat}
            onCancel={cancel}
            className="h-full min-w-0 flex-1"
          />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(ChatPage)
