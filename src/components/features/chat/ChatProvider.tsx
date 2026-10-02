import React, { createContext, useContext } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useChat, UseChatReturn } from "@hooks/useChat"

const ChatContext = createContext<UseChatReturn | null>(null)

/**
 * One persisted chat for the whole app, shared by the Chat FAB and the /chat
 * page — a question asked in one continues in the other, in-flight stream
 * included. Mounted in `_app` beside ChatFab so it outlives navigation.
 *
 * The hook holds no page context: each consumer passes its own per send
 * (`sendMessage(..., context)`), so the FAB always speaks for the current page.
 * Persistence waits for a signed-in user, so an anonymous page never asks
 * svc-agent for a conversation.
 */
export function ChatProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  const { user } = useUser()
  const chat = useChat(undefined, { persist: !!user })
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>
}

export function useSharedChat(): UseChatReturn {
  const chat = useContext(ChatContext)
  if (!chat) throw new Error("useSharedChat must be used within ChatProvider")
  return chat
}
