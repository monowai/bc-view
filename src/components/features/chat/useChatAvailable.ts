import { useRouter } from "next/router"
import { usePermissions } from "@hooks/usePermissions"

export const CHAT_PATH = "/chat"

/**
 * Whether the docked chat can open here: AI access, and not on the chat page,
 * which takes over the conversation. Its launcher and the dock share this rule.
 */
export function useChatAvailable(): boolean {
  const { canUseAi, isLoading } = usePermissions()
  const { pathname } = useRouter()
  return !isLoading && canUseAi && pathname !== CHAT_PATH
}
