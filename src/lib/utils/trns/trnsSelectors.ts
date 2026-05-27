import type {
  Asset,
  Broker,
  Currency,
  Portfolio,
  Transaction,
  TrnDto,
  TrnPayload,
  TrnResponse,
} from "types/beancounter"

/**
 * Re-hydrates a normalised [[TrnPayload]] envelope back into the fat
 * [[Transaction]] shape that existing components consume. Asset,
 * Portfolio, Currency, and Broker lookups come from the envelope maps.
 *
 * Returns an empty array when the envelope or its trns list is missing
 * so callers can keep their existing `.map`/`.length` access patterns
 * without an extra null guard.
 */
export function denormalizeTrnPayload(
  payload: TrnPayload | null | undefined,
): Transaction[] {
  if (!payload?.trns?.length) return []
  const { trns, assets, portfolios, currencies, brokers } = payload
  return trns.map((dto) =>
    denormalizeTrn(dto, assets, portfolios, currencies, brokers),
  )
}

/**
 * Unwrap the outer `{ data: TrnPayload }` envelope and denormalize in one
 * step. Convenient at fetch boundaries:
 *
 * ```ts
 * const trns = denormalizeTrnResponse(await res.json())
 * ```
 */
export function denormalizeTrnResponse(
  response: TrnResponse | null | undefined,
): Transaction[] {
  return denormalizeTrnPayload(response?.data)
}

/**
 * Server-side proxy transform: takes the backend `{ data: TrnPayload }`
 * envelope and returns the legacy `{ data: Transaction[] }` shape that
 * existing browser-side components consume. Used by API route handlers
 * to keep UI code untouched while the inter-service hop ships the
 * normalised envelope.
 *
 * Defensive: a route that handles multiple methods may also serve
 * non-TrnResponse payloads (e.g. DELETE returns `{ data: string[] }`).
 * The transform inspects the shape and only rewrites when it sees an
 * actual TrnPayload (object with a `trns` array).
 */
export function transformTrnEnvelopeJson(json: unknown): unknown {
  if (
    json !== null &&
    typeof json === "object" &&
    "data" in (json as Record<string, unknown>)
  ) {
    const envelope = json as Record<string, unknown>
    const data = envelope.data
    if (
      data !== null &&
      typeof data === "object" &&
      Array.isArray((data as { trns?: unknown }).trns)
    ) {
      // Preserve top-level metadata (e.g. `warnings` raised by auto-settle).
      const denormalized = denormalizeTrnPayload(data as TrnPayload)
      const result: Record<string, unknown> = { data: denormalized }
      if (Array.isArray(envelope.warnings)) {
        result.warnings = envelope.warnings
      }
      return result
    }
  }
  return json
}

function denormalizeTrn(
  dto: TrnDto,
  assets: Record<string, Asset>,
  portfolios: Record<string, Portfolio>,
  currencies: Record<string, Currency>,
  brokers: Record<string, Broker>,
): Transaction {
  const asset = assets[dto.assetId]
  const portfolio = portfolios[dto.portfolioId]
  const tradeCurrency = currencies[dto.tradeCurrencyCode]
  if (!asset || !portfolio || !tradeCurrency) {
    throw new Error(
      `Invalid TrnPayload refs for trn ${dto.id} ` +
        `(assetId=${dto.assetId}, portfolioId=${dto.portfolioId}, ` +
        `tradeCurrencyCode=${dto.tradeCurrencyCode})`,
    )
  }
  const cashAsset = dto.cashAssetId
    ? lookup(assets, dto.cashAssetId, dto.id, "cashAssetId")
    : undefined
  const cashCurrency = dto.cashCurrencyCode
    ? lookup(currencies, dto.cashCurrencyCode, dto.id, "cashCurrencyCode")
    : undefined
  const broker = dto.brokerId
    ? lookup(brokers, dto.brokerId, dto.id, "brokerId")
    : undefined

  return {
    id: dto.id,
    callerRef: dto.callerRef ?? { provider: "", batch: "", callerId: "" },
    trnType: dto.trnType,
    status: dto.status,
    portfolio,
    asset,
    cashAsset,
    tradeDate: dto.tradeDate,
    quantity: dto.quantity,
    price: dto.price ?? 0,
    tradeCurrency,
    tradeAmount: dto.tradeAmount,
    tradeBaseRate: dto.tradeBaseRate,
    tradePortfolioRate: dto.tradePortfolioRate,
    cashCurrency: cashCurrency?.code ?? "",
    cashAmount: dto.cashAmount,
    tradeCashRate: dto.tradeCashRate,
    fees: dto.fees,
    tax: dto.tax,
    comments: dto.comments ?? "",
    broker,
    brokerId: dto.brokerId ?? undefined,
    modelId: dto.modelId ?? undefined,
    subAccounts: dto.subAccounts ?? undefined,
  }
}

function lookup<T>(
  map: Record<string, T>,
  id: string,
  trnId: string,
  field: string,
): T {
  const value = map[id]
  if (!value) {
    throw new Error(`TrnPayload missing ${field}=${id} for trn ${trnId}`)
  }
  return value
}
