import React, { useEffect, useRef, useState } from "react"
import { ConversationSummary } from "types/agent"
import { formatRelativeTime } from "./relativeTime"

interface ConversationListProps {
  conversations: ConversationSummary[]
  activeId: string | null
  isLoading?: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  /** Saves a new title; resolves once the list shows it, rejects on failure. */
  onRename: (id: string, title: string) => Promise<void>
  onNewChat: () => void
  /** When given, a toggle in the header hides the sidebar. */
  onCollapse?: () => void
  className?: string
}

/** svc-agent clips titles to this length; stop the input there too. */
export const TITLE_MAX_LENGTH = 60

function without(
  titles: Record<string, string>,
  id: string,
): Record<string, string> {
  const rest = { ...titles }
  delete rest[id]
  return rest
}

interface TitleInputProps {
  title: string
  onSave: (title: string) => void
  onCancel: () => void
}

/**
 * Inline title editor. Enter or leaving the field saves, Escape cancels; a
 * blank or unchanged title cancels too. Settles once — the blur that follows
 * Enter or Escape unmounting the field is ignored.
 */
function TitleInput({
  title,
  onSave,
  onCancel,
}: TitleInputProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)
  const settled = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (save: boolean): void => {
    if (settled.current) return
    settled.current = true
    const next = inputRef.current?.value.trim() ?? ""
    if (save && next && next !== title) onSave(next)
    else onCancel()
  }

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={title}
      maxLength={TITLE_MAX_LENGTH}
      aria-label="Conversation title"
      enterKeyHint="done"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          finish(true)
        } else if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
      className="flex-1 min-w-0 m-1 px-2 py-1.5 text-sm text-gray-900 bg-white border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  )
}

/**
 * Sidebar of past AI conversations for the /chat page. Deleting asks for an
 * inline confirmation on the row itself, and renaming edits the title in
 * place — no browser dialogs. One row is in an inline mode at a time.
 */
export default function ConversationList({
  conversations,
  activeId,
  isLoading = false,
  onSelect,
  onDelete,
  onRename,
  onNewChat,
  onCollapse,
  className = "",
}: ConversationListProps): React.ReactElement {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  // Titles shown while a rename is in flight, by conversation id.
  const [savingTitles, setSavingTitles] = useState<Record<string, string>>({})
  const [failedId, setFailedId] = useState<string | null>(null)

  const startRename = (id: string): void => {
    setConfirmingId(null)
    setFailedId(null)
    setEditingId(id)
  }

  const startDelete = (id: string): void => {
    setEditingId(null)
    setFailedId(null)
    setConfirmingId(id)
  }

  // Only clear the edit this row owns — a late blur must not end another's.
  const stopEditing = (id: string): void =>
    setEditingId((current) => (current === id ? null : current))

  const save = (id: string, title: string): void => {
    stopEditing(id)
    setSavingTitles((titles) => ({ ...titles, [id]: title }))
    onRename(id, title)
      .catch(() => setFailedId(id))
      .finally(() => setSavingTitles((titles) => without(titles, id)))
  }

  return (
    <nav
      aria-label="Conversations"
      className={`flex flex-col bg-white rounded-lg shadow-lg overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200 bg-gray-50">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide conversations"
            aria-expanded={true}
            title="Hide conversations"
            className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
            <i className="fas fa-angle-double-left"></i>
          </button>
        )}
        <button
          type="button"
          onClick={onNewChat}
          className="btn-primary btn-primary--sm flex-1 justify-center"
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
          const title = savingTitles[c.id] ?? c.title
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
          if (editingId === c.id) {
            return (
              <li
                key={c.id}
                className={`flex items-center rounded-md ${
                  active ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <TitleInput
                  title={c.title}
                  onSave={(next) => save(c.id, next)}
                  onCancel={() => stopEditing(c.id)}
                />
              </li>
            )
          }
          return (
            <li
              key={c.id}
              className={`group rounded-md transition-colors ${
                active ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  onDoubleClick={() => startRename(c.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex-1 min-w-0 text-left px-2 py-2"
                >
                  <span
                    className={`block text-sm truncate ${
                      active ? "font-semibold text-blue-700" : "text-gray-700"
                    }`}
                  >
                    {title}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {formatRelativeTime(c.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => startRename(c.id)}
                  aria-label={`Rename "${title}"`}
                  title="Rename conversation"
                  className="shrink-0 px-2 py-2 text-xs text-gray-300 hover:text-blue-600 transition-colors"
                >
                  <i className="fas fa-pen"></i>
                </button>
                <button
                  type="button"
                  onClick={() => startDelete(c.id)}
                  aria-label={`Delete "${title}"`}
                  title="Delete conversation"
                  className="shrink-0 px-2 py-2 text-xs text-gray-300 hover:text-red-600 transition-colors"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              {failedId === c.id && (
                <p role="alert" className="px-2 pb-2 text-xs text-red-600">
                  Couldn’t rename — try again.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface ConversationRailProps {
  onExpand: () => void
  onNewChat: () => void
  className?: string
}

/**
 * Slim rail shown in place of the collapsed sidebar: just the toggle to
 * bring the conversations back and a "New chat" shortcut.
 */
export function ConversationRail({
  onExpand,
  onNewChat,
  className = "",
}: ConversationRailProps): React.ReactElement {
  return (
    <div
      className={`flex-col items-center gap-2 w-11 shrink-0 py-3 bg-white rounded-lg shadow-lg ${className}`}
    >
      <button
        type="button"
        onClick={onExpand}
        aria-label="Show conversations"
        aria-expanded={false}
        title="Show conversations"
        className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
      >
        <i className="fas fa-angle-double-right"></i>
      </button>
      <button
        type="button"
        onClick={onNewChat}
        aria-label="New chat"
        title="New chat"
        className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
      >
        <i className="fas fa-plus"></i>
      </button>
    </div>
  )
}
