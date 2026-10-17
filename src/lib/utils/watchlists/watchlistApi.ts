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

interface ErrorEnvelope {
  message?: string
  error?: string
}

async function request(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ErrorEnvelope
    throw new WatchlistApiError(
      res.status,
      data.message || data.error || `Request failed (${res.status})`,
    )
  }
  return res
}

/** POST / PATCH: the backend always answers `{ data: WatchlistItem }`. */
async function sendForItem(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<WatchlistItem> {
  const res = await request(url, method, body)
  const text = res.status === 204 ? "" : await res.text()
  const parsed = text ? (JSON.parse(text) as { data?: WatchlistItem }) : {}
  if (!parsed.data) {
    throw new WatchlistApiError(
      res.status,
      `Watchlist ${method} returned no response body`,
    )
  }
  return parsed.data
}

const itemsUrl = `${watchlistKey}/items`

export function addWatchlistItem(
  request: WatchlistItemRequest,
): Promise<WatchlistItem> {
  return sendForItem(itemsUrl, "POST", request)
}

export function updateWatchlistItem(
  itemId: string,
  update: WatchlistItemUpdate,
): Promise<WatchlistItem> {
  return sendForItem(`${itemsUrl}/${itemId}`, "PATCH", update)
}

export async function removeWatchlistItem(itemId: string): Promise<void> {
  // svc-data answers 200 `{ deleted }`; a 204 is equally fine. Either way
  // there is nothing to return, so the body is not read.
  await request(`${itemsUrl}/${itemId}`, "DELETE")
}

/**
 * Parse an optional price field. Three results, and callers must branch on all:
 * - blank → `undefined`: omit the field and let the server decide
 * - a positive number (commas allowed) → that number
 * - anything else → `null`: invalid; show a validation error, never submit
 */
export function parseOptionalPrice(text: string): number | undefined | null {
  const trimmed = text.replace(/,/g, "").trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : null
}
