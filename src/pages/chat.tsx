import React, { useCallback, useEffect, useRef, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import useSwr from "swr"
import { ChatPanel } from "@components/features/chat"
import ConversationList from "@components/features/chat/ConversationList"
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // A finished send creates or bumps a conversation — refresh the list.
  const wasLoading = useRef(isLoading)
  useEffect(() => {
    if (wasLoading.current && !isLoading) void mutate()
    wasLoading.current = isLoading
  }, [isLoading, mutate])

  const select = useCallback(
    (id: string) => {
      setSidebarOpen(false)
      void loadConversation(id)
    },
    [loadConversation],
  )

  const startNewChat = useCallback(() => {
    setSidebarOpen(false)
    newChat()
  }, [newChat])

  const remove = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/agent/conversations/${encodeURIComponent(id)}`, {
          method: "DELETE",
        })
      } catch {
        // Network failure — the refreshed list below shows what survived.
      }
      if (id === conversationId) newChat()
      void mutate()
    },
    [conversationId, newChat, mutate],
  )

  return (
    <>
      <Head>
        <title>Chat - Holdsworth</title>
      </Head>
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-6xl flex-col gap-2 px-2 sm:px-1 md:px-0">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-expanded={sidebarOpen}
          className="md:hidden self-start text-sm text-gray-600 hover:text-blue-600 transition-colors"
        >
          <i className="fas fa-history mr-1"></i>
          Conversations
        </button>
        <div className="relative flex min-h-0 flex-1 gap-3">
          <ConversationList
            conversations={data?.data ?? []}
            activeId={conversationId}
            isLoading={listLoading}
            onSelect={select}
            onDelete={(id) => void remove(id)}
            onNewChat={startNewChat}
            className={`${
              sidebarOpen ? "flex" : "hidden"
            } absolute inset-y-0 left-0 z-10 w-full max-w-xs md:static md:flex md:w-64 md:shrink-0`}
          />
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
