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
    const rows = Object.values(data).map((row) =>
      selectedColumns
        .map((col) => {
          switch (col) {
            case "Asset Code":
              return row.asset.code
            case "Asset Name":
              return row.asset.name
            case "Price":
              return row.moneyValues[valueIn].priceData?.close || ""
            case "Change Percent":
              return row.moneyValues[valueIn].priceData?.changePercent || ""
            case "Quantity":
              return row.quantityValues.total
            case "Cost Value":
              return row.moneyValues[valueIn].costValue
            case "Market Value":
              return row.moneyValues[valueIn].marketValue
            case "Gain On Day":
              return row.moneyValues[valueIn].gainOnDay
            case "Unrealised Gain":
              return row.moneyValues[valueIn].unrealisedGain
            case "Realised Gain":
              return row.moneyValues[valueIn].realisedGain
            case "Dividends":
              return row.moneyValues[valueIn].dividends
            case "IRR":
              return row.moneyValues[valueIn].irr
            case "Weight":
              return row.moneyValues[valueIn].weight
            case "Total Gain":
              return row.moneyValues[valueIn].totalGain
            default:
              return ""
          }
        })
        .join("\t"),
    )
    const clipboardData = [selectedColumns.join("\t"), ...rows].join("\n")

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(clipboardData).then(() => {
        onClose()
      }).catch((err) => {
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
