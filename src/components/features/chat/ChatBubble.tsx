import React, { useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatMessage } from "types/agent"

interface ChatBubbleProps {
  message: ChatMessage
  /** Resends the message; preserves the original deep-think state. */
  onRetry?: (content: string, deepThink: boolean) => void
}

export default function ChatBubble({
  message,
  onRetry,
}: ChatBubbleProps): React.ReactElement {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (isUser) {
    return (
      <div className="group flex justify-end">
        <div className="max-w-[80%] px-4 py-2 rounded-lg bg-blue-500 text-white text-sm">
          {message.deepThink && (
            <span
              className="inline-block mr-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-purple-200 text-purple-800"
              title="Sent with deep think enabled"
            >
              <i className="fas fa-brain mr-1"></i>deep
            </span>
          )}
          {message.content}
          <div className="flex justify-end gap-2 mt-1">
            {onRetry && (
              <button
                onClick={() =>
                  onRetry(message.content, message.deepThink ?? false)
                }
                className="text-blue-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                aria-label="Retry message"
                title="Send again"
              >
                <i className="fas fa-redo"></i>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="text-blue-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity text-xs"
              aria-label="Copy message"
              title={copied ? "Copied!" : "Copy to clipboard"}
            >
              <i className={`fas ${copied ? "fa-check" : "fa-copy"}`}></i>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex justify-start">
      <div
        className={`max-w-[92%] sm:max-w-[80%] px-4 py-2 rounded-lg text-sm border ${
          message.error
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="prose prose-sm max-w-none prose-table:my-2 prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: (props) => (
                <div className="overflow-x-auto -mx-2 my-2">
                  <table {...props} className="text-xs" />
                </div>
              ),
              th: (props) => <th {...props} className="whitespace-nowrap" />,
            }}
          >
            {message.content}
          </Markdown>
        </div>
        <div className="flex justify-end mt-1">
          <button
            onClick={handleCopy}
            className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            aria-label="Copy message"
            title={copied ? "Copied!" : "Copy to clipboard"}
          >
            <i className={`fas ${copied ? "fa-check" : "fa-copy"}`}></i>
          </button>
        </div>
      </div>
    </div>
  )
}
