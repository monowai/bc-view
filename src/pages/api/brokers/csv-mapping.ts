import { NextApiRequest, NextApiResponse } from "next"
import { auth0 } from "@lib/auth0"
import { getWaharoaUrl } from "@utils/api/bcConfig"
import {
  COULD_NOT_SUGGEST,
  type CsvMapping,
  parseMappingReply,
} from "@utils/csvImport/csvMapping"
import {
  MAPPING_SYSTEM_PROMPT,
  MAX_COLUMNS,
  mappingUserPrompt,
} from "@utils/csvImport/mappingPrompt"

const DEFAULT_MODEL = "deepseek-flash"
/** A gateway that has not answered by then gets the 502 fallback, not a hung request. */
const GATEWAY_TIMEOUT_MS = 30_000

const isRow = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((cell) => typeof cell === "string")

/** The gateway's suggested mapping, checked; null when it fails or is not a mapping. */
async function askGateway(
  gateway: string,
  key: string,
  headers: string[],
  samples: string[][],
): Promise<CsvMapping | null> {
  const reply = await fetch(`${gateway}/v1/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.BC_WAHAROA_MODEL?.trim() || DEFAULT_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: MAPPING_SYSTEM_PROMPT },
        { role: "user", content: mappingUserPrompt(headers, samples) },
      ],
    }),
  })
  if (!reply.ok) {
    console.error("csv-mapping: gateway answered", reply.status)
    return null
  }
  const body = (await reply.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  try {
    return parseMappingReply(
      JSON.parse(body.choices?.[0]?.message?.content ?? ""),
      headers.length,
    )
  } catch {
    return null
  }
}

/**
 * Suggest how a transaction CSV maps onto Beancounter's columns. Runs server
 * side: waharoa (the LLM gateway) is internal only, and its key never reaches
 * the browser. The caller sends the header row and a few sample rows.
 */
export default async function csvMapping(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  const session = await auth0.getSession(req)
  if (!session) {
    res.status(401).json({ error: "Not authenticated" })
    return
  }
  const { headers, samples } = (req.body ?? {}) as Record<string, unknown>
  if (
    !isRow(headers) ||
    headers.length === 0 ||
    headers.length > MAX_COLUMNS ||
    !Array.isArray(samples) ||
    !samples.every(isRow)
  ) {
    res.status(400).json({ error: "Send the header row and sample rows" })
    return
  }
  const gateway = getWaharoaUrl()
  const key = process.env.AI_GATEWAY_KEY?.trim()
  if (!gateway || !key) {
    res.status(503).json({ error: "Suggesting a mapping is not set up here." })
    return
  }
  try {
    const mapping = await askGateway(gateway, key, headers, samples)
    if (!mapping) {
      res.status(502).json({ error: COULD_NOT_SUGGEST })
      return
    }
    res.status(200).json({ data: mapping })
  } catch (error) {
    console.error("csv-mapping: gateway unreachable", error)
    res.status(502).json({ error: COULD_NOT_SUGGEST })
  }
}
