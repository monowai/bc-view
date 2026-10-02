import { useState, useCallback, useRef, useEffect } from "react"
import { describeAgentError } from "@utils/agent/agentErrors"
import {
  ChatMessage,
  ChatTurn,
  ConversationDetail,
  ConversationTurn,
} from "types/agent"

/** Trailing turns sent as history — mirrors svc-agent's server-side cap. */
const MAX_HISTORY_TURNS = 6

const CONVERSATIONS_API = "/api/agent/conversations"

/** localStorage key holding the persisted chat's current conversation id. */
export const CONVERSATION_STORAGE_KEY = "bc.chat.conversationId"

// localStorage can be missing (SSR) or throw (private mode, blocked storage);
// the conversation id is a convenience, so every access fails soft.
function readStoredConversationId(): string | null {
  try {
    return window.localStorage.getItem(CONVERSATION_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeConversationId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(CONVERSATION_STORAGE_KEY, id)
    else window.localStorage.removeItem(CONVERSATION_STORAGE_KEY)
  } catch {
    // Storage unavailable — the conversation just won't resume on reload.
  }
}

/**
 * A stored turn as the chat renders it. A failed answer is stored with empty
 * content and its svc-agent code; it is described exactly as a live `error`
 * event is, so a reloaded failure reads the same as when it happened.
 */
export function turnToMessage(turn: ConversationTurn): ChatMessage {
  return {
    id: turn.id,
    role: turn.role,
    content:
      turn.error && turn.content.length === 0
        ? describeAgentError(turn.error).message
        : turn.content,
    timestamp: turn.timestamp,
    deepThink: turn.deepThink || undefined,
    error: turn.error,
  }
}

/** Starts an empty server-side conversation; null when that isn't possible. */
async function createConversation(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(CONVERSATIONS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: { id?: string } }
    return json.data?.id ?? null
  } catch {
    return null
  }
}

/**
 * Next SSE frame boundary — a blank line as either `\n\n` or `\r\n\r\n`.
 * Proxies (CDN / load balancer) may normalise line endings to CRLF.
 */
function findSeparator(buf: string): { index: number; len: number } | null {
  const lf = buf.indexOf("\n\n")
  const crlf = buf.indexOf("\r\n\r\n")
  if (lf === -1 && crlf === -1) return null
  if (lf === -1) return { index: crlf, len: 4 }
  if (crlf === -1) return { index: lf, len: 2 }
  return crlf < lf ? { index: crlf, len: 4 } : { index: lf, len: 2 }
}

interface UseChatOptions {
  /** Transcript to resume from, e.g. a cached Quick Analysis thread. */
  initialMessages?: ChatMessage[]
  /**
   * Record the chat server-side as a svc-agent conversation. The first send
   * of a fresh chat creates one; later sends continue it by id instead of
   * replaying `history`. The id survives a reload via localStorage. Off by
   * default — Quick Analysis threads and other one-off chats stay stateless.
   */
  persist?: boolean
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  /**
   * Send a query to svc-agent. `deepThink` (default `false`) escalates the
   * agent to its DEEP tier — see `AgentQuery.deepThink`. `think` (default
   * `false`) enables DeepSeek thinking mode — pre-canned / suggested prompts
   * leave it `false` for the fastest response; the free-text Chat FAB passes
   * `true` (`AgentQuery.think`). Persisted on the user message via `deepThink`
   * so chat history can render a badge. `label`, when set, is displayed in
   * place of `query` on the user message (see `ChatMessage.label`).
   * `context`, when given, is sent in place of the hook's — a shared chat
   * passes the caller's current page context per send.
   */
  sendMessage: (
    query: string,
    deepThink?: boolean,
    think?: boolean,
    label?: string,
    context?: Record<string, unknown>,
  ) => Promise<void>
  /** Starts over: clears the transcript and forgets the conversation. */
  newChat: () => void
  /**
   * Replaces the transcript, e.g. with a thread handed over to the FAB. The
   * thread is not a stored conversation, so it continues statelessly.
   */
  loadTranscript: (messages: ChatMessage[]) => void
  /** Persisted conversation being continued; null for a fresh/stateless chat. */
  conversationId: string | null
  /**
   * Replaces the transcript with a stored conversation. An id the server no
   * longer knows (404) is forgotten and the chat starts fresh.
   */
  loadConversation: (id: string) => Promise<void>
  /**
   * Aborts the in-flight stream. Any tokens already received remain on the
   * assistant message; isLoading flips false. No-op when nothing is in flight.
   */
  cancel: () => void
}

/**
 * Streams the agent response via Server-Sent Events.
 *
 * The browser sees a first byte within ~1–2s as svc-agent emits `event: token`
 * chunks. Without streaming the heavy Independence / Rebalance domains
 * routinely exceed mobile-Safari's ~30s idle-timeout and surface as a generic
 * "Load failed" — see `pages/api/agent/query/stream.ts` for the proxy.
 */
export function useChat(
  context?: Record<string, unknown>,
  options: UseChatOptions = {},
): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(
    () => options.initialMessages ?? [],
  )
  const [isLoading, setIsLoading] = useState(false)
  const persist = options.persist ?? false
  const [conversationId, setConversationIdState] = useState<string | null>(null)
  // Source of truth for sends — sendMessage is memoized and must see the id
  // a previous send just created without waiting for a re-render.
  const conversationIdRef = useRef<string | null>(null)
  // Bumped whenever the transcript is replaced, so a slow conversation load
  // can't overwrite a newer choice (New chat, another conversation).
  const loadSeqRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  // sendMessage is memoized, so it can't read `messages`
  // directly without going stale after the first render — mirror it into a
  // ref instead so each call sees the latest transcript.
  const messagesRef = useRef<ChatMessage[]>(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const setConversation = useCallback(
    (id: string | null) => {
      conversationIdRef.current = id
      setConversationIdState(id)
      if (persist) storeConversationId(id)
    },
    [persist],
  )

  const sendMessage = useCallback(
    async (
      query: string,
      deepThink: boolean = false,
      think: boolean = false,
      label?: string,
      callContext?: Record<string, unknown>,
    ) => {
      // A send supersedes any conversation load still in flight.
      loadSeqRef.current++
      // Only a chat started from empty becomes a stored conversation; a
      // handed-over transcript has no server-side twin, so it stays stateless.
      const freshChat = messagesRef.current.length === 0
      // Snapshot the transcript so far as history — before appending this
      // turn's placeholders — so the model sees its own prior question when
      // the user replies to it instead of retyping the whole context. Error
      // turns (failed / cancelled requests) are excluded: the model never
      // actually said that text, so replaying it back as an assistant turn
      // would be misleading context, not a real prior answer.
      const history: ChatTurn[] = messagesRef.current
        .filter((m) => m.content.length > 0 && !m.error)
        .slice(-MAX_HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }))

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        timestamp: new Date().toISOString(),
        deepThink: deepThink || undefined,
        label,
      }
      setMessages((prev) => [...prev, userMsg])
      setIsLoading(true)

      // Reserve a placeholder assistant message that we mutate as chunks
      // arrive. The empty string is fine — ChatPanel renders the
      // `Thinking...` indicator from `isLoading` until tokens land.
      const assistantId = crypto.randomUUID()
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ])

      const finalize = (
        update: (msg: ChatMessage) => Partial<ChatMessage>,
      ): void => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...update(m) } : m)),
        )
      }

      const controller = new AbortController()
      abortRef.current = controller

      try {
        let activeId = persist ? conversationIdRef.current : null
        if (persist && activeId === null && freshChat) {
          // Can't create one (agent down, etc.)? Still answer — statelessly.
          activeId = await createConversation(controller.signal)
          if (activeId !== null && !controller.signal.aborted) {
            setConversation(activeId)
          }
        }
        // A stored conversation is replayed server-side, so `history` would
        // be ignored — don't send it.
        const res = await fetch("/api/agent/query/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            query,
            context: callContext ?? context,
            deepThink,
            think,
            history:
              activeId === null && history.length > 0 ? history : undefined,
            conversationId: activeId ?? undefined,
          }),
          signal: controller.signal,
        })
        if (activeId !== null && res.status === 404) {
          // Expired (90-day retention) or deleted elsewhere — forget it.
          setConversation(null)
        }
        if (!res.ok || !res.body) {
          // One extraction feeds both fields: `content` is the copy, `error`
          // is the raw signal it was derived from, so a recorded failure and
          // the message on screen can never describe different things.
          // A classified status (402 / 429 / 504) keeps its code rather than
          // the bare "HTTP 402", so a consumer re-describing `error` gets the
          // same copy back.
          const failure = describeAgentError(`HTTP ${res.status}`, res.status)
          finalize(() => ({
            content: failure.message,
            error: failure.code === "unknown" ? failure.detail : failure.code,
          }))
          return
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""

        // SSE event blocks are delimited by a blank line (see findSeparator). Inside each block
        // we look for `event: <type>` and `data: <body>` lines. We accept
        // multi-`data:` events by joining their bodies with newlines.
        //
        // We deliberately don't strip a leading space from `data:` lines.
        // The SSE spec lets a server write either `data:foo` or `data: foo`
        // for content `foo` — Spring's `ServerSentEvent` writer chooses the
        // first form, so any leading space on a `data:` line IS part of the
        // payload. Stripping it dropped spaces between adjacent token chunks
        // and produced run-on words like "Theplan", "fortwo".
        const flush = (block: string): void => {
          let event = "message"
          const dataLines: string[] = []
          for (const raw of block.split(/\r?\n/)) {
            if (raw.startsWith(":")) continue
            if (raw.startsWith("event:")) {
              event = raw.slice(6).trim()
            } else if (raw.startsWith("data:")) {
              dataLines.push(raw.slice(5))
            }
          }
          const data = dataLines.join("\n")
          if (event === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + data } : m,
              ),
            )
          } else if (event === "reset") {
            // Emitted after a narration turn (the LLM's "I'll gather the
            // data…" preamble before tool calls). Discard the in-progress
            // assistant message's content — the final answer arrives after
            // the last reset — leaving earlier chat history untouched.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: "" } : m,
              ),
            )
          } else if (event === "error") {
            const code = data || "stream-error"
            finalize((m) => ({
              content:
                m.content.length > 0
                  ? m.content
                  : describeAgentError(code).message,
              error: code,
            }))
          }
          // `done` carries metadata only; nothing to render right now.
        }

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          let sep = findSeparator(buffer)
          while (sep !== null) {
            const block = buffer.slice(0, sep.index)
            buffer = buffer.slice(sep.index + sep.len)
            if (block.length > 0) flush(block)
            sep = findSeparator(buffer)
          }
        }
        if (buffer.trim().length > 0) flush(buffer)
      } catch (error: unknown) {
        if (controller.signal.aborted) {
          // User cancelled — keep any partial content already streamed and
          // tag the message so consumers can render a "cancelled" hint.
          finalize((m) => ({
            content: m.content.length > 0 ? m.content : "Cancelled.",
            error: "cancelled",
          }))
          return
        }
        const failure = describeAgentError(error)
        finalize(() => ({
          content: failure.message,
          error: failure.detail || "Unknown error",
        }))
      } finally {
        if (abortRef.current === controller) abortRef.current = null
        setIsLoading(false)
      }
    },
    [context, persist, setConversation],
  )

  const newChat = useCallback(() => {
    loadSeqRef.current++
    abortRef.current?.abort()
    setConversation(null)
    setMessages([])
  }, [setConversation])

  const loadTranscript = useCallback(
    (transcript: ChatMessage[]) => {
      loadSeqRef.current++
      setConversation(null)
      setMessages(transcript)
    },
    [setConversation],
  )

  const loadConversation = useCallback(
    async (id: string) => {
      const seq = ++loadSeqRef.current
      abortRef.current?.abort()
      try {
        const res = await fetch(
          `${CONVERSATIONS_API}/${encodeURIComponent(id)}`,
        )
        if (seq !== loadSeqRef.current) return
        if (res.status === 404) {
          setConversation(null)
          setMessages([])
          return
        }
        // Any other failure is treated as transient: keep the id so the
        // next load (or reload) can still resume it.
        if (!res.ok) return
        const json = (await res.json()) as { data: ConversationDetail }
        if (seq !== loadSeqRef.current) return
        setMessages(json.data.messages.map(turnToMessage))
        setConversation(json.data.id)
      } catch {
        // Network failure — leave the current chat as it is.
      }
    },
    [setConversation],
  )

  // Resume the stored conversation. Post-mount, because localStorage doesn't
  // exist during SSR — reading it in render would mismatch hydration. Same
  // post-mount hydration pattern as ChatFab's corner; state only changes after
  // the fetch resolves, the compiler just can't see past the await.
  useEffect(() => {
    if (!persist) return
    const stored = readStoredConversationId()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) void loadConversation(stored)
  }, [persist, loadConversation])

  return {
    messages,
    isLoading,
    sendMessage,
    newChat,
    loadTranscript,
    cancel,
    conversationId,
    loadConversation,
  }
}
