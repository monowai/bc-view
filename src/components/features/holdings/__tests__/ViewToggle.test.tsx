import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ViewToggle from "../ViewToggle"

describe("ViewToggle Component Tests (TDD)", () => {
  const mockOnViewModeChange = jest.fn()

  beforeEach(() => {
    mockOnViewModeChange.mockClear()
  })

  describe("Rendering", () => {
    it("should render both Table and Heatmap buttons", () => {
      render(
        <ViewToggle viewMode="table" onViewModeChange={mockOnViewModeChange} />,
      )

      expect(screen.getByLabelText("Table view")).toBeInTheDocument()
      expect(screen.getByLabelText("Heatmap view")).toBeInTheDocument()
    })

    it("should highlight Table button when viewMode is table", () => {
      render(
        <ViewToggle viewMode="table" onViewModeChange={mockOnViewModeChange} />,
      )

      const tableButton = screen.getByLabelText("Table view")
      const heatmapButton = screen.getByLabelText("Heatmap view")

      expect(tableButton).toHaveClass("bg-white", "text-gray-900", "shadow-sm")
      expect(heatmapButton).toHaveClass("text-gray-600")
      expect(heatmapButton).not.toHaveClass("bg-white")
    })

    it("should highlight Heatmap button when viewMode is heatmap", () => {
      render(
        <ViewToggle
          viewMode="heatmap"
          onViewModeChange={mockOnViewModeChange}
        />,
      )

      const tableButton = screen.getByLabelText("Table view")
      const heatmapButton = screen.getByLabelText("Heatmap view")

      expect(heatmapButton).toHaveClass(
        "bg-white",
        "text-gray-900",
        "shadow-sm",
      )
      expect(tableButton).toHaveClass("text-gray-600")
      expect(tableButton).not.toHaveClass("bg-white")
    })
  })

  describe("Interactions", () => {
    it("should call onViewModeChange with 'table' when Table button is clicked", () => {
      render(
        <ViewToggle
          viewMode="heatmap"
          onViewModeChange={mockOnViewModeChange}
        />,
      )

      const tableButton = screen.getByLabelText("Table view")
      fireEvent.click(tableButton)

      expect(mockOnViewModeChange).toHaveBeenCalledWith("table")
      expect(mockOnViewModeChange).toHaveBeenCalledTimes(1)
    })

    it("should call onViewModeChange with 'heatmap' when Heatmap button is clicked", () => {
      render(
        <ViewToggle viewMode="table" onViewModeChange={mockOnViewModeChange} />,
      )

      const heatmapButton = screen.getByLabelText("Heatmap view")
      fireEvent.click(heatmapButton)

      expect(mockOnViewModeChange).toHaveBeenCalledWith("heatmap")
      expect(mockOnViewModeChange).toHaveBeenCalledTimes(1)
    })
  })
})
