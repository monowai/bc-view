/**
 * The rules of the screenshot import that need no React: turning what was read
 * into editable rows, the rows into requests, and codes into plain words.
 */
import { describeAgentError } from "@lib/agent/agentErrors"
import { SCREENSHOT_TOO_LARGE } from "@lib/agent/screenshotLimit"
import { formatQuantity } from "@utils/formatters"
import type {
  ConfirmedRow,
  ReconcilePreview,
  ReconcileMarketSource,
  ReconcilePreviewRow,
  ReconcileRowStatus,
  ReconcileRowWarning,
  ScreenshotProposal,
  ShownHolding,
} from "types/beancounter"

export const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif"

export const UNREACHABLE =
  "Beancounter could not be reached. Check your connection and try again."

/**
 * One holding as the user sees and edits it. The editable fields stay as the
 * text the user typed; numbers are made only when a request is built.
 */
export interface ImportRow {
  key: string
  code: string
  market: string
  quantity: string
  /** Total cost of the shown holding. */
  cost: string
  /** The asset's name as printed, to tell rows apart. */
  name: string
  /** When the holding was opened (yyyy-mm-dd); "" for the import's date. */
  heldSince: string
  /** Where `heldSince` came from when the user did not enter it. */
  heldSinceHint?: string
  /** Where svc-data found `market`; absent once the user chooses it. */
  marketFrom?: ReconcileMarketSource | null
  /** Printed figures the user does not edit; sent so the server can cross-check. */
  printed: Pick<
    ShownHolding,
    "costPerShare" | "price" | "marketValue" | "gainLoss"
  >
}

const text = (value: number | null | undefined): string =>
  value == null ? "" : String(value)

const printed = (value: number | null | undefined): number | undefined =>
  value == null ? undefined : value

/** A code as Beancounter writes it: a share class is BRK.B, not BRK/B. */
const beancounterCode = (code: string): string =>
  code.trim().replace(/\//g, ".")

export const READ_FROM_IMAGE = "Read from the image"
export const GUESSED_FROM_COST = "Guessed from the cost"
export const GUESSED_BEFORE_PRICES = "Guessed: bought before the earliest price"

export function toImportRows(proposal: ScreenshotProposal): ImportRow[] {
  return proposal.rows.map((row, index) => ({
    key: `row-${index}`,
    code: beancounterCode(row.code ?? ""),
    market: "",
    quantity: text(row.quantity),
    cost: text(row.costBasis),
    name: row.name?.trim() ?? "",
    // A holdings page that prints when a position was opened says it best.
    heldSince: row.tradeDate ?? "",
    heldSinceHint: row.tradeDate ? READ_FROM_IMAGE : undefined,
    printed: {
      costPerShare: printed(row.costPerShare),
      price: printed(row.price),
      marketValue: printed(row.marketValue),
      gainLoss: printed(row.gainLoss),
    },
  }))
}

/**
 * The number a user typed, or undefined when the field is blank or is not a
 * number. Grouping commas and spaces are dropped ("1,750" is 1750), so what
 * is sent never carries a locale separator.
 */
export function parseAmount(typed: string): number | undefined {
  const cleaned = typed.replace(/[,\s]/g, "")
  if (cleaned === "") return undefined
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

/** How a row is named to the user and to assistive technology. */
export function rowName(row: ImportRow, index: number): string {
  return row.code.trim() || row.name || `row ${index + 1}`
}

/** Only a row with a code can be looked up. */
export const canBeChecked = (row: ImportRow): boolean => row.code.trim() !== ""

/** A row as the preview endpoint takes it. Blank fields are left out. */
export function toShownHolding(row: ImportRow): ShownHolding {
  // A code typed by hand is sent as one read from the statement is.
  const shown: ShownHolding = { code: beancounterCode(row.code) }
  const market = row.market.trim()
  if (market) shown.market = market
  const quantity = parseAmount(row.quantity)
  if (quantity !== undefined) shown.quantity = quantity
  const costBasis = parseAmount(row.cost)
  if (costBasis !== undefined) shown.costBasis = costBasis
  for (const field of [
    "costPerShare",
    "price",
    "marketValue",
    "gainLoss",
  ] as const) {
    const value = row.printed[field]
    if (value !== undefined) shown[field] = value
  }
  return shown
}

/** The editable values of a row; two rows with the same one preview alike. */
export function signature(row: ImportRow): string {
  if (!canBeChecked(row)) return ""
  return JSON.stringify([
    row.code.trim(),
    row.market.trim(),
    row.quantity.trim(),
    row.cost.trim(),
  ])
}

/** What a preview said, keyed to the rows it was asked about. */
export interface CheckedRows {
  rows: ImportRow[]
  previewByKey: Record<string, ReconcilePreviewRow>
  /** Each row's signature as it was checked. */
  checked: Record<string, string>
}

/**
 * Attach a preview to the rows it was asked about. The preview answers one
 * row per row sent, in order. A row the user left without a market takes the
 * one the server worked out, so the next check names it.
 *
 * @param rows the rows now on screen, which may have been edited since
 * @param sent the rows the preview was asked about
 */
export function attachPreview(
  rows: ImportRow[],
  sent: ImportRow[],
  preview: ReconcilePreview,
): CheckedRows {
  const previewByKey: Record<string, ReconcilePreviewRow> = {}
  const checked: Record<string, string> = {}
  const markets: Record<string, string> = {}
  const sources: Record<string, ReconcileMarketSource | null> = {}
  sent.forEach((row, index) => {
    const answer = preview.rows[index]
    if (!answer) return
    const market = row.market.trim() || answer.market || ""
    previewByKey[row.key] = answer
    markets[row.key] = market
    sources[row.key] = answer.marketSource ?? null
    checked[row.key] = signature({ ...row, market })
  })
  return {
    previewByKey,
    checked,
    rows: rows.map((row) =>
      !row.market.trim() && markets[row.key]
        ? { ...row, market: markets[row.key], marketFrom: sources[row.key] }
        : row,
    ),
  }
}

/** Beancounter's asset, or the market and code a listing new to it is created under. */
function assetNamed(
  preview: ReconcilePreviewRow,
): Pick<ConfirmedRow, "assetId" | "market" | "code"> | null {
  if (preview.assetId) return { assetId: preview.assetId }
  if (preview.market && preview.assetCode)
    return { market: preview.market, code: preview.assetCode }
  return null
}

/** The transaction a READY row becomes, or null when it is not recordable. */
export function toConfirmedRow(
  preview: ReconcilePreviewRow | undefined,
): ConfirmedRow | null {
  if (
    preview?.status !== "READY" ||
    !preview.trnType ||
    preview.quantity == null
  ) {
    return null
  }
  const named = assetNamed(preview)
  if (!named) return null
  const row: ConfirmedRow = {
    ...named,
    trnType: preview.trnType,
    quantity: preview.quantity,
  }
  if (preview.trnType === "ADD" && preview.cost != null) row.cost = preview.cost
  return row
}

export const STATUS_COPY: Record<ReconcileRowStatus, string> = {
  READY: "Ready to record",
  UNCHANGED: "Matches what is held",
  NEEDS_QUANTITY: "Enter the quantity",
  NEEDS_MARKET: "Choose the market",
  UNRESOLVED: "Beancounter does not know this asset on that market",
  NEEDS_COST: "Enter the cost",
}

/** Why svc-data chose a market the user did not name. */
export const MARKET_SOURCE_COPY: Partial<
  Record<ReconcileMarketSource, string>
> = {
  LISTED: "The only market that lists it",
}

/** "Listed on ASX and US. Choose the market." for a code on several markets. */
export function chooseAmong(markets: string[]): string {
  const named =
    markets.length > 1
      ? `${markets.slice(0, -1).join(", ")} and ${markets[markets.length - 1]}`
      : markets.join("")
  return `Listed on ${named}. Choose the market.`
}

export const NEEDS_CODE = "Enter the code"
export const NOT_CHECKED = "Changed since the last check. Press Recheck."
/** No check has answered for the row yet, for example because the check failed. */
export const NEVER_CHECKED = "Not checked yet. Press Recheck."

export const WARNING_COPY: Record<ReconcileRowWarning, string> = {
  MARKET_VALUE_MISMATCH:
    "Quantity times price does not match the market value shown",
  GAIN_LOSS_MISMATCH:
    "Market value less cost does not match the gain or loss shown",
}

/** The proposed change in plain words: "Add 10", "Reduce 3", "No change". */
export function describeChange(preview: ReconcilePreviewRow): string {
  if (preview.status === "UNCHANGED") return "No change"
  if (!preview.trnType || preview.quantity == null) return ""
  const verb = preview.trnType === "ADD" ? "Add" : "Reduce"
  return `${verb} ${formatQuantity(preview.quantity)}`
}

interface RefusalBody {
  message?: unknown
  error?: unknown
}

/**
 * Why the reader refused a screenshot, in words for the user. The statuses
 * are `ScreenshotController`'s. Its quota and unverified-email refusals carry
 * prose and no code, so they are shown as sent unless a code is found.
 */
export async function readRefusal(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as RefusalBody | null
  const said =
    [body?.message, body?.error].find(
      (value): value is string => typeof value === "string" && value !== "",
    ) ?? ""
  switch (res.status) {
    case 401:
      return "Your session has ended. Sign in again, then retry."
    case 413:
      return SCREENSHOT_TOO_LARGE
    case 415:
      return "That file is not an image Beancounter can read. Upload a PNG, JPEG, WebP or GIF image."
    case 422:
      return said
        ? `Beancounter could not read that screenshot: ${said}`
        : "Beancounter could not read that screenshot. Try a clearer screenshot of your holdings."
    case 502:
      return "The screenshot reader is unavailable right now. Nothing was recorded. Try again in a few minutes."
    default: {
      const known = describeAgentError(body)
      if (known.code !== "unknown") return `${known.title}. ${known.message}`
      return (
        said ||
        `The screenshot could not be read (error ${res.status}). Try again.`
      )
    }
  }
}
