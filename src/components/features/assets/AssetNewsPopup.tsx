import React from "react"
import useSWR from "swr"
import Dialog from "@components/ui/Dialog"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { newsKey, simpleFetcher } from "@utils/api/fetchHelper"
import { formatDate } from "@lib/formatters"
import { NewsArticle, NewsResponse } from "types/beancounter"

interface AssetNewsPopupProps {
  symbol: string
  market?: string
  name?: string
  onClose: () => void
}

// AlphaVantage publishes `20260930T120000`; EODHD sends ISO.
const COMPACT_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/

const publishedDate = (timePublished: string): string =>
  formatDate(timePublished.replace(COMPACT_TIME, "$1-$2-$3T$4:$5:$6"))

const isUrl = (source: string): boolean => /^https?:\/\//.test(source)

// A provider can send a malformed URL ("https://"); show it raw rather than
// let one bad article take down the popup.
const sourceLabel = (source: string): string => {
  if (!isUrl(source)) return source
  try {
    return new URL(source).hostname.replace(/^www\./, "")
  } catch {
    return source
  }
}

const sentimentClass = (label: string): string => {
  if (label.includes("Bullish")) return "bg-green-100 text-green-800"
  if (label.includes("Bearish")) return "bg-red-100 text-red-800"
  return "bg-gray-100 text-gray-700"
}

function ArticleRow({ article }: { article: NewsArticle }): React.ReactElement {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        {isUrl(article.source) ? (
          <a
            href={article.source}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-700 hover:underline"
          >
            {article.title}
          </a>
        ) : (
          <span className="font-medium text-gray-900">{article.title}</span>
        )}
        {article.sentimentLabel && (
          <span
            className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${sentimentClass(article.sentimentLabel)}`}
          >
            {article.sentimentLabel}
          </span>
        )}
      </div>
      <div className="mt-1 flex gap-2 text-xs text-gray-500">
        {article.source && <span>{sourceLabel(article.source)}</span>}
        {article.timePublished && (
          <span>{publishedDate(article.timePublished)}</span>
        )}
      </div>
      {article.summary && (
        <p className="mt-1 text-sm text-gray-700 line-clamp-3">
          {article.summary}
        </p>
      )}
    </li>
  )
}

function NewsBody({
  symbol,
  feed,
  isLoading,
  failed,
}: {
  symbol: string
  feed: NewsArticle[]
  isLoading: boolean
  failed: boolean
}): React.ReactElement {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-gray-500">
        <Spinner className="mr-2" />
        {"Loading news..."}
      </div>
    )
  }
  if (failed) {
    return (
      <Alert variant="error">{"Could not load news. Try again later."}</Alert>
    )
  }
  if (feed.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        {`No recent news for ${symbol}.`}
      </p>
    )
  }
  return (
    <ul className="divide-y divide-gray-200">
      {feed.map((article, i) => (
        <ArticleRow key={`${article.title}-${i}`} article={article} />
      ))}
    </ul>
  )
}

export default function AssetNewsPopup({
  symbol,
  market,
  name,
  onClose,
}: AssetNewsPopupProps): React.ReactElement {
  const key = newsKey(symbol, market)
  const { data, error, isLoading } = useSWR<NewsResponse>(
    key,
    simpleFetcher(key),
  )
  const feed = data?.feed ?? []

  return (
    <Dialog
      title={
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span>
            <i className="fas fa-newspaper text-blue-600 mr-2"></i>
            {`News — ${symbol}`}
          </span>
          {name && name !== symbol && (
            <span className="text-base font-medium text-gray-700">{name}</span>
          )}
          {market && (
            <span className="text-sm font-normal text-gray-500">
              {`(${market})`}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      maxWidth="2xl"
      scrollable
    >
      <NewsBody
        symbol={symbol}
        feed={feed}
        isLoading={isLoading}
        failed={!!error}
      />
    </Dialog>
  )
}
