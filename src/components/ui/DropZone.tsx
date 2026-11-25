import { refreshHoldingsSoon } from "@lib/trns/refreshHoldings"
import React, { ReactElement, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Portfolio, TransactionImport } from "types/beancounter"
import { DelimitedImport } from "types/app"
import Papa from "papaparse"
import { readFileText } from "@utils/readFileText"
import { mutate } from "swr"
import { importTrnRow } from "@utils/api/client/trns"

// Read a CSV file into rows.
async function readFile(file: Blob): Promise<string[][]> {
  return Papa.parse(await readFileText(file)).data as string[][]
}

// Function to post data to API
export function postData(
  portfolio: Portfolio,
  purge: boolean,
  row: string[],
): Promise<Response> {
  return importTrnRow({
    hasHeader: true,
    portfolio: portfolio,
    purge: purge,
    row,
  } as unknown as DelimitedImport)
}

// DropZone component
function DropZone({
  onDrop,
  hideIcon = false,
}: {
  onDrop: (acceptedFiles: Blob[]) => void
  hideIcon?: boolean
}): React.ReactElement {
  const { getRootProps, getInputProps } = useDropzone({ onDrop })
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {!hideIcon && (
        <span>
          <i className="far fa-circle-up fa-3x" />
        </span>
      )}
    </div>
  )
}

interface TrnDropZoneProps extends TransactionImport {
  hideIcon?: boolean
}

export default function TrnDropZone({
  portfolio,
  purge,
  hideIcon = false,
}: TrnDropZoneProps): ReactElement {
  const onDrop = useCallback(
    async (acceptedFiles: Blob[]) => {
      let rows = 0
      for (const file of acceptedFiles) {
        try {
          const results = await readFile(file)
          let headerSkipped = false
          for (const row of results) {
            if (headerSkipped) {
              if (row && row.length > 1 && !row[0].startsWith("#")) {
                console.log("Posting import request")
                await postData(portfolio, purge, row)
                  .then(() => rows++)
                  .then()
              }
            } else headerSkipped = true
          }
        } catch (error) {
          console.error(error)
        }
      }
      console.log(`Sent ${rows} rows`)
      if (rows > 0) {
        refreshHoldingsSoon(mutate, portfolio.code)
      }
    },
    [portfolio, purge],
  )

  if (portfolio.id === "new") {
    return <div />
  }
  return <DropZone onDrop={onDrop} hideIcon={hideIcon} />
}
