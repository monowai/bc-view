import React, { useEffect, useRef, useState } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { usePermissions } from "@hooks/usePermissions"
import { describeAgentError } from "@utils/agent/agentErrors"
import ChatBubble from "./ChatBubble"
import { requestChatOpen } from "./chatBus"
import {
  AnalysisRequest,
  analysisSucceeded,
  useAnalysisChat,
} from "./useAnalysisChat"

interface AnalysisDialogProps {
  title: React.ReactNode
  request: AnalysisRequest
  /** Spinner copy while the opening analysis has produced nothing yet. */
  loadingLabel: string
  onClose: () => void
}

// Within this many pixels of the bottom still counts as "at the bottom";
// browser scroll math has sub-pixel rounding.
const STICK_TO_BOTTOM_THRESHOLD_PX = 24

const REPORT_PROSE = `prose prose-sm sm:prose-base max-w-none
  prose-headings:text-slate-900 prose-headings:font-semibold
  prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
  prose-h2:mt-6 prose-h2:mb-3 prose-h3:mt-4 prose-h3:mb-2
  prose-p:text-slate-700 prose-p:leading-relaxed
  prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
  prose-strong:text-slate-900
  prose-ul:my-3 prose-li:my-1
  prose-table:text-sm`

/**
 * Dialog shell shared by the Quick Analysis popups. Streams the canned
 * analysis as a report, then lets the reader ask follow-ups in place — or
 * carry the whole thread into the chat FAB with "Open in chat".
 */
export default function AnalysisDialog({
  title,
  request,
  loadingLabel,
  onClose,
}: AnalysisDialogProps): React.ReactElement {
  const { messages, isLoading, sendMessage, cancel } = useAnalysisChat(request)
  const { ai: canChat } = usePermissions()
  const [question, setQuestion] = useState("")
  const threadEndRef = useRef<HTMLDivElement>(null)

  const report = messages[1]
  const followUps = messages.slice(2)
  const succeeded = analysisSucceeded(messages)
  const failure =
    report?.error && report.error !== "cancelled"
      ? describeAgentError(report.error)
      : null
  const last = messages[messages.length - 1]
  const awaitingFirstToken = isLoading && !last?.content

  // Stick to the bottom while a follow-up answer streams, unless the reader
  // has scrolled up to re-read — same rule as ChatPanel. The Dialog body
  // (this thread's parent) is the scroll container.
  const stickToBottomRef = useRef(true)
  useEffect(() => {
    const scroller = threadEndRef.current?.parentElement
    if (!scroller) return () => {}
    const onScroll = (): void => {
      stickToBottomRef.current =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <
        STICK_TO_BOTTOM_THRESHOLD_PX
    }
    scroller.addEventListener("scroll", onScroll)
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [])

  // A new question always brings the thread into view.
  useEffect(() => {
    stickToBottomRef.current = true
    threadEndRef.current?.scrollIntoView?.({ block: "end" })
  }, [followUps.length])

  // The opening report is read top-down, so only follow-up answers are followed.
  const followUpChars = followUps.length > 0 ? (last?.content.length ?? 0) : 0
  useEffect(() => {
    if (stickToBottomRef.current) {
      threadEndRef.current?.scrollIntoView?.({ block: "end" })
    }
  }, [followUpChars])

  // Closing abandons an in-flight stream rather than leaving it to bill.
  const close = (): void => {
    cancel()
    onClose()
  }

  const ask = (e: React.FormEvent): void => {
    e.preventDefault()
    const q = question.trim()
    if (!q || isLoading) return
    setQuestion("")
    void sendMessage(q)
  }

  const openInChat = (): void => {
    requestChatOpen({ transcript: messages, context: request.context })
    close()
  }

  const cancelButton = (
    <button
      type="button"
      onClick={cancel}
      className="px-2 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 ring-1 ring-slate-200"
      aria-label="Cancel"
      title="Cancel"
    >
      <i className="fas fa-stop text-[10px] mr-1"></i>
      Cancel
    </button>
  )

  const footer = succeeded ? (
    <form onSubmit={ask} className="flex flex-1 items-center gap-2">
      <input
        type="text"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a follow-up about this analysis..."
        aria-label="Follow-up question"
        className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={isLoading || question.trim().length === 0}
        aria-label="Send follow-up"
        className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
      >
        <i className="fas fa-paper-plane"></i>
      </button>
      {canChat && (
        <button
          type="button"
          onClick={openInChat}
          disabled={isLoading}
          className="px-3 py-2 rounded-md text-sm text-blue-700 hover:bg-blue-50 whitespace-nowrap disabled:opacity-50"
          title="Continue this conversation in the chat panel"
        >
          <i className="fas fa-comments mr-1"></i>
          Open in chat
        </button>
      )}
    </form>
  ) : undefined

  return (
    <Dialog
      title={title}
      onClose={close}
      maxWidth="4xl"
      scrollable
      footer={footer}
    >
      {awaitingFirstToken && followUps.length === 0 && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 text-gray-500 py-12"
        >
          <div className="flex items-center gap-2">
            <Spinner />
            <span>{loadingLabel}</span>
          </div>
          {cancelButton}
        </div>
      )}
      {report?.content && !failure && (
        <div className={REPORT_PROSE}>
          <Markdown remarkPlugins={[remarkGfm]}>{report.content}</Markdown>
        </div>
      )}
      <Dialog.ErrorAlert
        title={failure?.title}
        tone={failure?.tone}
        message={failure?.message ?? null}
      />
      {followUps.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
          {followUps
            .filter((m) => m.content.length > 0)
            .map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
        </div>
      )}
      {isLoading && !(awaitingFirstToken && followUps.length === 0) && (
        <div className="mt-3 flex items-center gap-2 text-gray-400 text-xs">
          <Spinner />
          <span>{awaitingFirstToken ? "Thinking…" : "Streaming…"}</span>
          {cancelButton}
        </div>
      )}
      <div ref={threadEndRef} />
    </Dialog>
  )
}
