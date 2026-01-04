import React from "react"

export type ViewMode = "summary" | "table" | "cards" | "heatmap"

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
        onClick={() => onViewModeChange("summary")}
        className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === "summary"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-label="Summary view"
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <span className="hidden sm:inline text-xs">Summary</span>
      </button>
      <button
        onClick={() => onViewModeChange("cards")}
        className={`flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors ${
          viewMode === "cards"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-600 hover:text-gray-900"
        }`}
        aria-label="Cards view"
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
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
        <span className="hidden sm:inline text-xs">Cards</span>
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
    </div>
  )
}

export default ViewToggle
