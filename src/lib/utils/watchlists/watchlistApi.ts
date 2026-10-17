import {
  WatchlistItem,
  WatchlistItemRequest,
  WatchlistItemUpdate,
} from "types/beancounter"
import { watchlistKey } from "@utils/api/fetchHelper"

/** A failed watchlist call, keeping the HTTP status so callers can branch on 400 / 409. */
export class WatchlistApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "WatchlistApiError"
    this.status = status
  }
}

async function send<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new WatchlistApiError(
      res.status,
      data?.message || data?.error || `Request failed (${res.status})`,
    )
  }
  // DELETE may answer 204 or an empty 200; neither is JSON.
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const itemsUrl = `${watchlistKey}/items`

export async function addWatchlistItem(
  request: WatchlistItemRequest,
): Promise<WatchlistItem> {
  const res = await send<{ data: WatchlistItem }>(itemsUrl, "POST", request)
  return res.data
}

export async function updateWatchlistItem(
  itemId: string,
  update: WatchlistItemUpdate,
): Promise<WatchlistItem> {
  const res = await send<{ data: WatchlistItem }>(
    `${itemsUrl}/${itemId}`,
    "PATCH",
    update,
  )
  return res.data
}

export async function removeWatchlistItem(itemId: string): Promise<void> {
  await send(`${itemsUrl}/${itemId}`, "DELETE")
}

/**
 * Parse an optional price field. Blank → undefined (let the server decide);
 * anything else must be a positive number.
 */
export function parseOptionalPrice(text: string): number | undefined | null {
  const trimmed = text.replace(/,/g, "").trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : null
}
