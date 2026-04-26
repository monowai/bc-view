import React, { useState, useRef, useEffect } from "react"
import { ChatMessage } from "types/agent"
import ChatBubble from "./ChatBubble"
import Spinner from "@components/ui/Spinner"
import { ChatCorner } from "./chatPosition"

interface ChatPanelProps {
  messages: ChatMessage[]
  isLoading: boolean
  onSend: (query: string) => void
  onClear: () => void
  className?: string
  placeholder?: string
  suggestions?: string[]
  onExpand?: () => void
  /** When provided, the header shows a small blue X next to Clear that calls this. */
  onClose?: () => void
  /** Current FAB corner; pass with onMove to enable the picker. */
  corner?: ChatCorner
  /** Move callback — pairs with corner; opens a 2x2 picker in the header. */
  onMove?: (next: ChatCorner) => void
}

const CORNER_PICKER: { value: ChatCorner; icon: string; label: string }[] = [
  { value: "TL", icon: "fa-arrow-up", label: "Top-left" },
  { value: "TR", icon: "fa-arrow-up", label: "Top-right" },
  { value: "BL", icon: "fa-arrow-down", label: "Bottom-left" },
  { value: "BR", icon: "fa-arrow-down", label: "Bottom-right" },
]

export default function ChatPanel({
  messages,
  isLoading,
  onSend,
  onClear,
  className = "",
  placeholder = "Ask about your portfolios...",
  suggestions = [],
  onExpand,
  onClose,
  corner,
  onMove,
}: ChatPanelProps): React.ReactElement {
  const [input, setInput] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInput("")
  }

  return (
    <div
      className={`flex flex-col bg-white rounded-lg shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <i className="fas fa-robot text-blue-600"></i>
          <span className="text-sm font-semibold text-gray-700">
            Holdsworth Assistant
          </span>
        </div>
        <div className="flex items-center gap-2 relative">
          {onMove && corner && (
            <>
              <button
                onClick={() => setShowPicker((v) => !v)}
                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                aria-label="Move chat panel"
                title="Move to a different corner"
              >
                <i className="fas fa-arrows-alt"></i>
              </button>
              {showPicker && (
                <div
                  className="absolute right-0 top-7 z-10 bg-white border border-gray-200 rounded-md shadow-md p-1 grid grid-cols-2 gap-1"
                  role="menu"
                  aria-label="Choose chat panel corner"
                >
                  {CORNER_PICKER.map(({ value, icon, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        onMove(value)
                        setShowPicker(false)
                      }}
                      aria-label={label}
                      title={label}
                      aria-pressed={corner === value}
                      className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-colors ${
                        corner === value
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      <i
                        className={`fas ${icon} ${
                          value === "TR" || value === "BR"
                            ? "rotate-45"
                            : "-rotate-45"
                        }`}
                      ></i>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {onExpand && (
            <button
              onClick={onExpand}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              aria-label="Expand chat"
              title="Open full chat"
            >
              <i className="fas fa-expand-alt"></i>
            </button>
          )}
          <button
            onClick={onClear}
            disabled={messages.length === 0}
            className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 transition-colors"
            aria-label="Clear chat"
          >
            Clear
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
              aria-label="Close chat"
              title="Close chat"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <i className="fas fa-comments text-3xl mb-2"></i>
            <p className="mb-3">
              Ask me about your portfolios, holdings, or plans
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-1.5 w-full max-w-xs">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onSend(suggestion)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-blue-300 text-gray-500 hover:text-blue-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} onRetry={onSend} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Spinner />
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </form>
    </div>
  )
}
