import React, { useState, useMemo } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import useSwr from "swr"
import { ChatPanel } from "@components/features/chat"
import { getPageContext } from "@components/features/chat/pageContext"
import { useChat } from "@hooks/useChat"
import { usePortfolios } from "@hooks/usePortfolios"
import { holdingKey, simpleFetcher } from "@utils/api/fetchHelper"
import { extractTickers } from "../lib/holdings/tickerExtraction"

function NewsPage(): React.ReactElement {
  const { portfolios, isLoading: portfoliosLoading } = usePortfolios()
  const [selectedCode, setSelectedCode] = useState("")

  const activeCode = selectedCode || portfolios[0]?.code || ""

  const { data: holdingsData } = useSwr(
    activeCode ? holdingKey(activeCode, "today") : null,
    activeCode ? simpleFetcher(holdingKey(activeCode, "today")) : null,
  )

  const tickers = useMemo(
    () =>
      holdingsData?.data?.positions
        ? extractTickers(holdingsData.data.positions)
        : [],
    [holdingsData],
  )

  const pageCtx = getPageContext("/news")

  const context = useMemo(
    () => ({
      page: pageCtx.page,
      description: pageCtx.description,
      portfolioCode: activeCode,
      tickers: tickers.join(","),
    }),
    [pageCtx.page, pageCtx.description, activeCode, tickers],
  )

  const { messages, isLoading, sendMessage, clearMessages } = useChat(context)

  return (
    <>
      <Head>
        <title>News & Sentiment - Holdsworth</title>
      </Head>
      <div className="mx-auto max-w-5xl py-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-800">
              <i className="fas fa-newspaper text-blue-600 mr-2"></i>
              News & Sentiment
            </h1>
            <select
              value={activeCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={portfoliosLoading}
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ticker chips */}
          {tickers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tickers.map((ticker) => (
                <span
                  key={ticker}
                  data-testid="ticker-chip"
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {ticker}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className="h-[calc(100vh-14rem)]">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
            onClear={clearMessages}
            placeholder={pageCtx.placeholder}
            suggestions={pageCtx.suggestions}
            className="h-full"
          />
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(NewsPage)
