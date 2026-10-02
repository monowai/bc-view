import React, { useState } from "react"
import { ConversationSummary } from "types/agent"
import { formatRelativeTime } from "./relativeTime"

interface ConversationListProps {
  conversations: ConversationSummary[]
  activeId: string | null
  isLoading?: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
  className?: string
}

/**
 * Sidebar of past AI conversations for the /chat page. Deleting asks for an
 * inline confirmation on the row itself — no browser dialogs.
 */
export default function ConversationList({
  conversations,
  activeId,
  isLoading = false,
  onSelect,
  onDelete,
  onNewChat,
  className = "",
}: ConversationListProps): React.ReactElement {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <nav
      aria-label="Conversations"
      className={`flex flex-col bg-white rounded-lg shadow-lg overflow-hidden ${className}`}
    >
      <div className="px-3 py-3 border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          onClick={onNewChat}
          className="btn-primary btn-primary--sm w-full justify-center"
        >
          <i className="fas fa-plus mr-2"></i>
          New chat
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading && conversations.length === 0 && (
          <li className="px-2 py-3 text-xs text-gray-400">Loading…</li>
        )}
        {!isLoading && conversations.length === 0 && (
          <li className="px-2 py-3 text-xs text-gray-400">
            No conversations yet
          </li>
        )}
        {conversations.map((c) => {
          const active = c.id === activeId
          if (confirmingId === c.id) {
            return (
              <li
                key={c.id}
                className="rounded-md border border-red-200 bg-red-50 px-2 py-2"
              >
                <p className="text-xs text-gray-700 truncate mb-2">
                  Delete “{c.title}”?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingId(null)
                      onDelete(c.id)
                    }}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="px-2 py-1 text-xs text-gray-600 rounded hover:bg-gray-100 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              </li>
            )
          }
          return (
            <li
              key={c.id}
              className={`group flex items-center rounded-md transition-colors ${
                active ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={active ? "true" : undefined}
                className="flex-1 min-w-0 text-left px-2 py-2"
              >
                <span
                  className={`block text-sm truncate ${
                    active ? "font-semibold text-blue-700" : "text-gray-700"
                  }`}
                >
                  {c.title}
                </span>
                <span className="block text-xs text-gray-400">
                  {formatRelativeTime(c.updatedAt)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmingId(c.id)}
                aria-label={`Delete "${c.title}"`}
                title="Delete conversation"
                className="shrink-0 px-2 py-2 text-xs text-gray-300 hover:text-red-600 transition-colors"
              >
                <i className="fas fa-trash-alt"></i>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
