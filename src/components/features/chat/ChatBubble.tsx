import React from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ChatMessage } from "types/agent"

interface ChatBubbleProps {
  message: ChatMessage
}

export default function ChatBubble({
  message,
}: ChatBubbleProps): React.ReactElement {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2 rounded-lg bg-blue-500 text-white text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
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
      </div>
    </div>
  )
}
