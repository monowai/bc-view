import React from "react"
import { useStatementImport } from "./useStatementImport"
import UploadStep from "./UploadStep"
import ConfirmStep from "./ConfirmStep"
import DoneStep from "./DoneStep"
import CsvMappingStep from "./CsvMappingStep"

/**
 * Import into a brokerage account from a screenshot of its holdings, or from a
 * CSV of its transactions: upload, confirm what was read or how the columns
 * map, record. Nothing is recorded before the user presses Record.
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
  if (flow.csvFlow.csv)
    return <CsvMappingStep flow={flow.csvFlow} onCancel={flow.reset} />
  if (flow.session) return <ConfirmStep flow={flow} />
  return <UploadStep flow={flow} />
}
