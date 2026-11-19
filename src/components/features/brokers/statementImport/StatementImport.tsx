import React from "react"
import { useStatementImport } from "./useStatementImport"
import UploadStep from "./UploadStep"
import ConfirmStep from "./ConfirmStep"
import DoneStep from "./DoneStep"

/**
 * Import holdings from a screenshot of a brokerage account: upload, confirm
 * what was read, record. Nothing is recorded before the user presses Record.
 */
export default function StatementImport(): React.ReactElement {
  const flow = useStatementImport()

  if (flow.result) {
    return (
      <DoneStep
        recorded={flow.result.recorded}
        warnings={flow.result.warnings}
        brokerId={flow.result.brokerId}
        portfolio={flow.result.portfolio}
        loadFrom={flow.result.loadFrom}
        onImportAnother={flow.reset}
      />
    )
  }
  if (flow.session) return <ConfirmStep flow={flow} />
  return <UploadStep flow={flow} />
}
