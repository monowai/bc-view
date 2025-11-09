import React from "react"

export type ViewMode = "table" | "heatmap"

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

const ViewToggle: React.FC<ViewToggleProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex items-center space-x-0.5 bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => onViewModeChange("table")}
        className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === "table"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-label="Table view"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M3 10h18M3 16h18"
          />
        </svg>
        <span className="hidden sm:inline text-xs">Table</span>
      </button>
      <button
        onClick={() => onViewModeChange("heatmap")}
        className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === "heatmap"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-label="Heatmap view"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
        <span className="hidden sm:inline text-xs">Heatmap</span>
      </button>
    </div>
  )
}

export default ViewToggle
