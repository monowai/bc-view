import React, { useState } from "react"
import { Position } from "types/beancounter"
import { getReportCategory } from "@lib/categoryMapping"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import Dialog from "@components/ui/Dialog"

interface CopyPopupProps {
  columns: string[]
  data: Record<string, Position>
  valueIn: string
  modalOpen: boolean
  onClose: () => void
}

const CopyPopup: React.FC<CopyPopupProps> = ({
  columns,
  data,
  valueIn,
  modalOpen,
  onClose,
}) => {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  const handleColumnChange = (column: string): void => {
    setSelectedColumns((prev) =>
      prev.includes(column)
        ? prev.filter((col) => col !== column)
        : [...prev, column],
    )
  }

  const handleCopy = (): void => {
    const rows = Object.values(data)
      .filter((row) => row.quantityValues.total !== 0) // Exclude rows with undefined quantityValues or total === 0
      .map((row) =>
        selectedColumns
          .map((col) => {
            switch (col.toLowerCase()) {
              case "asset code":
                return stripOwnerPrefix(row.asset.code)
              case "asset name":
                return row.asset.name
              case "classification":
                return getReportCategory(row.asset)
              case "price":
                return row.moneyValues[valueIn].priceData?.close || ""
              case "change %":
                return row.moneyValues[valueIn].priceData?.changePercent || ""
              case "change on day":
                return row.moneyValues[valueIn].gainOnDay
              case "quantity":
                return row.quantityValues?.total || ""
              case "cost value":
                return row.moneyValues[valueIn].costValue
              case "market value":
                return row.moneyValues[valueIn].marketValue
              case "unrealised gain":
                return row.moneyValues[valueIn].unrealisedGain
              case "realised gain":
                return row.moneyValues[valueIn].realisedGain
              case "dividends":
                return row.moneyValues[valueIn].dividends
              case "irr":
                return row.moneyValues[valueIn].irr
              case "weight":
                return row.moneyValues[valueIn].weight
              case "total gain":
                return row.moneyValues[valueIn].totalGain
              default:
                return ""
            }
          })
          .join("\t"),
      )
    const clipboardData = [selectedColumns.join("\t"), ...rows].join("\n")

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(clipboardData)
        .then(() => {
          onClose()
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err)
        })
    } else {
      // Fallback for unsupported environments
      const textarea = document.createElement("textarea")
      textarea.value = clipboardData
      textarea.style.position = "fixed" // Prevent scrolling to bottom
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      try {
        document.execCommand("copy")
        onClose()
      } catch (err) {
        console.error("Fallback: Failed to copy text: ", err)
      }
      document.body.removeChild(textarea)
    }
  }

  if (!modalOpen) {
    return null
  }

  return (
    <Dialog
      title="Select Columns to Copy"
      onClose={onClose}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} />
          <Dialog.SubmitButton
            onClick={handleCopy}
            label="Copy"
            variant="blue"
          />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {columns.map((column) => (
          <label key={column} className="flex items-center">
            <input
              type="checkbox"
              value={column}
              checked={selectedColumns.includes(column)}
              onChange={() => handleColumnChange(column)}
              className="mr-2"
            />
            {column}
          </label>
        ))}
      </div>
    </Dialog>
  )
}

export default CopyPopup
