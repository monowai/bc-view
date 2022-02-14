import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { TransactionImport } from "../../core/types/beancounter";
import { useKeycloak } from "@react-keycloak/ssr";
import { _axios, getBearerToken } from "../../core/common/axiosUtils";
import { writeRows } from "./import";
import { DelimitedImport } from "../../core/types/app";
import Papa from "papaparse";

export function TrnDropZone({ portfolio, purge }: TransactionImport): React.ReactElement {
  const { keycloak } = useKeycloak();
  // https://github.com/react-dropzone/react-dropzone
  const onDrop = useCallback(
    (acceptedFiles) => {
      acceptedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onabort = () => console.debug("file reading was aborted");
        reader.onerror = () => console.debug("file reading has failed");
        reader.onload = () => {
          // Do whatever you want with the file contents
          if (typeof reader.result === "string") {
            const results = Papa.parse(reader.result).data;
            const params: DelimitedImport = {
              hasHeader: true,
              portfolio: portfolio,
              purge: purge,
              results,
              token: keycloak?.token,
            };
            const rows = writeRows(params);
            console.debug("<<POST trnUpload sent %s", rows);
            _axios
              .post<string>(
                "/upload/trn",
                { portfolio: portfolio, message: "Finished sending " + rows + " rows" },
                {
                  headers: getBearerToken(keycloak?.token),
                }
              )
              .catch((err) => {
                if (err.response) {
                  console.error(
                    "axios error [%s]: [%s]",
                    err.response.status,
                    err.response.data.message
                  );
                }
              });
          }
        };
        reader.readAsText(file, "utf-8");
      });
    },
    [portfolio, keycloak, purge]
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
