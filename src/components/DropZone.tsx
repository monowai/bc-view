import React, { ReactElement, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Portfolio, TransactionImport } from "@components/types/beancounter"
import { DelimitedImport } from "@components/types/app"
import Papa from "papaparse"

// Function to read and parse file
function readFile(file: Blob): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => reject("File reading was aborted")
    reader.onerror = () => reject("File reading has failed")
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const results = Papa.parse(reader.result).data as string[][]
        resolve(results)
      } else {
        reject("File content is not a string")
      }
    }
    reader.readAsText(file, "utf-8")
  })
}

// Function to post data to API
export async function postData(
  portfolio: Portfolio,
  purge: boolean,
  row: string[],
): Promise<void> {
  await fetch(`/api/trns/import`, {
    method: "POST",
    mode: "cors",
    headers: {
      "content-type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({
      hasHeader: true,
      portfolio: portfolio,
      purge: purge,
      row,
    } as unknown as DelimitedImport),
  })
}

// DropZone component
function DropZone({
  onDrop,
}: {
  onDrop: (acceptedFiles: Blob[]) => void
}): React.ReactElement {
  const { getRootProps, getInputProps } = useDropzone({ onDrop })
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <span>
        <i className="far fa-arrow-alt-circle-up fa-3x" />
      </span>
    </div>
  )
}

export default function TrnDropZone({
  portfolio,
  purge,
}: TransactionImport): ReactElement {
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
    },
    [portfolio, purge],
  )

  if (portfolio.id === "new") {
    return <div />
  }
  return <DropZone onDrop={onDrop} />
}
