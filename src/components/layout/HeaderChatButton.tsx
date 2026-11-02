import React from "react"
import { useRouter } from "next/router"
import { requestChatOpen } from "@components/features/chat/chatBus"
import { usePermissions } from "@hooks/usePermissions"

/**
 * Opens the chat panel from the header. Comments, not the robot: the robot marks
 * one-shot AI analysis such as AI Portfolio Overview, and this is a conversation.
 */
export default function HeaderChatButton(): React.ReactElement | null {
  const { canUseAi, isLoading } = usePermissions()
  const { pathname } = useRouter()

  if (isLoading || !canUseAi || pathname === "/chat") return null

  return (
    <button
      type="button"
      onClick={() => requestChatOpen()}
      aria-label="Open chat"
      title="Chat"
      className="p-2 text-gray-300 hover:text-white transition-colors"
    >
      <i aria-hidden="true" className="fas fa-comments text-lg"></i>
    </button>
  )
}
