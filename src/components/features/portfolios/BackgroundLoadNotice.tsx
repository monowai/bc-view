import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"
import {
  BackgroundLoadResponse,
  loadCorporateEventsInBackground,
} from "@utils/api/client/corporateEvents"
import { readErrorMessage } from "@utils/api/readErrorMessage"

/** A started (or already running) background load, or why it could not start. */
export type BackgroundLoadOutcome =
  BackgroundLoadResponse | { status: "ERROR"; message: string }

const COULD_NOT_START = "Could not start loading corporate actions"

/** Ask svc-event to load a portfolio's corporate actions in the background. */
export async function startBackgroundLoad(
  portfolioId: string,
  asAt: string,
): Promise<BackgroundLoadOutcome> {
  try {
    const response = await loadCorporateEventsInBackground(portfolioId, asAt)
    if (!response.ok) {
      return {
        status: "ERROR",
        message: await readErrorMessage(response, COULD_NOT_START),
      }
    }
    return (await response.json()) as BackgroundLoadResponse
  } catch {
    return { status: "ERROR", message: COULD_NOT_START }
  }
}

/** Where corporate actions that are not yet paid wait to be confirmed. */
export function ProposedTransactionsLink(): React.ReactElement {
  return (
    <Link href="/trns/proposed" className="font-medium underline">
      Proposed Transactions
    </Link>
  )
}

/** Says what a background load does next, or why it could not start. */
export default function BackgroundLoadNotice({
  outcome,
  className,
}: {
  outcome: BackgroundLoadOutcome
  className?: string
}): React.ReactElement {
  if (outcome.status === "ERROR") {
    return (
      <Alert variant="error" className={className}>
        {outcome.message}
      </Alert>
    )
  }
  const lead =
    outcome.status === "STARTED"
      ? `Loading dividends and splits since ${outcome.asAt} in the background.`
      : "Already loading dividends and splits for this portfolio in the background."
  return (
    <Alert variant="info" className={className}>
      <p>
        {lead} Past ones are recorded as they arrive; any not yet paid wait in{" "}
        <ProposedTransactionsLink /> for you to confirm.
      </p>
    </Alert>
  )
}
