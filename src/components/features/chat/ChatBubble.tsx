import React, { useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatMessage } from "types/agent"

interface ChatBubbleProps {
  message: ChatMessage
  onRetry?: (content: string) => void
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
          {message.content}
          <div className="flex justify-end gap-2 mt-1">
            {onRetry && (
              <button
                onClick={() => onRetry(message.content)}
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
        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm border ${
          message.error
            ? "bg-red-50 border-red-200"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="prose prose-sm max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
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
