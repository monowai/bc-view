import React, { useState } from "react"
import { Position } from "../../types/beancounter"

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
                return row.asset.code
              case "asset name":
                return row.asset.name
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50">
        <h2 className="text-xl font-semibold mb-4">Select Columns to Copy</h2>
        <div className="mb-4 grid grid-cols-2 gap-2">
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
        <div className="flex justify-end space-x-2">
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={handleCopy}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}

export default CopyPopup
