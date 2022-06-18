import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { TransactionImport } from "@/types/beancounter";
import { DelimitedImport } from "@/types/app";
import Papa from "papaparse";

export function TrnDropZone({ portfolio, purge }: TransactionImport): React.ReactElement {
  // https://github.com/react-dropzone/react-dropzone
  const onDrop = useCallback(
    (acceptedFiles) => {
      let rows = 0;
      acceptedFiles.forEach((file: Blob) => {
        const reader = new FileReader();
        reader.onabort = () => console.debug("file reading was aborted");
        reader.onerror = () => console.debug("file reading has failed");
        reader.onload = () => {
          console.log("Step 1")
          if (typeof reader.result === "string") {
            console.log("is string")
            const results = Papa.parse(reader.result).data as string[];
            let headerSkipped = false;
            results.forEach(function (row: string) {
              if (headerSkipped) {
                console.log("Header Skipped")
                if (row && row.length > 1 && !row[0].startsWith("#")) {
                  console.log("Calling Fetch")
                  fetch(`/api/trns/import`, {
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
                    .then(() => rows++)
                    .catch(() => console.error("Something went wrong"));
                }
              } else headerSkipped = true;
            });
          }
        };
        reader.readAsText(file, "utf-8");
      });
      console.log(`Sent ${rows} rows`);
    },
    [portfolio, purge]
  );
  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  if (portfolio.id === "new") {
    return <div />;
  }
  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      <span>
        <i className="far fa-arrow-alt-circle-up fa-3x" />
      </span>
    </div>
  );
}
