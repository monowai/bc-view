import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import { ChatPanel } from "@components/features/chat"
import { useChat } from "@hooks/useChat"

function ChatPage(): React.ReactElement {
  const { messages, isLoading, sendMessage, clearMessages } = useChat()

  return (
    <>
      <Head>
        <title>Chat - Holdsworth</title>
      </Head>
      <div className="mx-auto h-[calc(100vh-5rem)] max-w-5xl">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          onSend={sendMessage}
          onClear={clearMessages}
          className="h-full"
        />
      </div>
    </>
  )
}

export default withPageAuthRequired(ChatPage)
