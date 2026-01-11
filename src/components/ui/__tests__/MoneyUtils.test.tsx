import React from "react"
import { render, screen } from "@testing-library/react"
import {
  FormatValue,
  ResponsiveFormatValue,
  PrivateQuantity,
} from "../MoneyUtils"

// Mock the usePrivacyMode hook
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: jest.fn(() => ({
    hideValues: false,
    toggleHideValues: jest.fn(),
  })),
}))

const { usePrivacyMode } = jest.requireMock("@hooks/usePrivacyMode")

describe("MoneyUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    usePrivacyMode.mockReturnValue({
      hideValues: false,
      toggleHideValues: jest.fn(),
    })
  })

  describe("FormatValue", () => {
    describe("when privacy mode is disabled", () => {
      it("renders numeric value with formatting", () => {
        render(<FormatValue value={1234.56} />)
        expect(screen.getByText("1,234.56")).toBeInTheDocument()
      })

      it("renders value with custom scale", () => {
        render(<FormatValue value={1234.5678} scale={3} />)
        expect(screen.getByText("1,234.568")).toBeInTheDocument()
      })

      it("renders value with multiplier", () => {
        render(<FormatValue value={0.1234} multiplier={100} />)
        expect(screen.getByText("12.34")).toBeInTheDocument()
      })

      it("renders default value for non-numeric value", () => {
        render(<FormatValue value={undefined} defaultValue="-" />)
        expect(screen.getByText("-")).toBeInTheDocument()
      })

      it("renders space as default value when not specified", () => {
        const { container } = render(<FormatValue value={undefined} />)
        expect(container.textContent).toBe(" ")
      })
    })

    describe("when privacy mode is enabled", () => {
      beforeEach(() => {
        usePrivacyMode.mockReturnValue({
          hideValues: true,
          toggleHideValues: jest.fn(),
        })
      })

      it("renders hidden placeholder for numeric value", () => {
        render(<FormatValue value={1234.56} />)
        expect(screen.getByText("****")).toBeInTheDocument()
        expect(screen.queryByText("1,234.56")).not.toBeInTheDocument()
      })

      it("renders hidden placeholder regardless of scale", () => {
        render(<FormatValue value={1234.5678} scale={3} />)
        expect(screen.getByText("****")).toBeInTheDocument()
      })

      it("renders hidden placeholder regardless of multiplier", () => {
        render(<FormatValue value={0.1234} multiplier={100} />)
        expect(screen.getByText("****")).toBeInTheDocument()
      })
    })

    describe("isPublic flag", () => {
      beforeEach(() => {
        usePrivacyMode.mockReturnValue({
          hideValues: true,
          toggleHideValues: jest.fn(),
        })
      })

      it("shows value when isPublic is true even in privacy mode", () => {
        render(<FormatValue value={1234.56} isPublic />)
        expect(screen.getByText("1,234.56")).toBeInTheDocument()
        expect(screen.queryByText("****")).not.toBeInTheDocument()
      })

      it("shows percentage values when isPublic is true", () => {
        render(<FormatValue value={0.0725} multiplier={100} isPublic />)
        expect(screen.getByText("7.25")).toBeInTheDocument()
      })
    })
  })

  describe("ResponsiveFormatValue", () => {
    describe("when privacy mode is disabled", () => {
      it("renders value for both mobile and desktop", () => {
        const { container } = render(<ResponsiveFormatValue value={1234.56} />)
        // Mobile view (no decimals)
        expect(container.querySelector(".sm\\:hidden")).toHaveTextContent(
          "1,235",
        )
        // Desktop view (with decimals)
        expect(
          container.querySelector(".hidden.sm\\:inline"),
        ).toHaveTextContent("1,234.56")
      })
    })

    describe("when privacy mode is enabled", () => {
      beforeEach(() => {
        usePrivacyMode.mockReturnValue({
          hideValues: true,
          toggleHideValues: jest.fn(),
        })
      })

      it("renders hidden placeholder", () => {
        render(<ResponsiveFormatValue value={1234.56} />)
        expect(screen.getByText("****")).toBeInTheDocument()
      })

      it("shows value when isPublic is true", () => {
        const { container } = render(
          <ResponsiveFormatValue value={1234.56} isPublic />,
        )
        expect(screen.queryByText("****")).not.toBeInTheDocument()
        expect(container.querySelector(".sm\\:hidden")).toHaveTextContent(
          "1,235",
        )
      })
    })
  })

  describe("PrivateQuantity", () => {
    describe("when privacy mode is disabled", () => {
      it("renders quantity with default precision (0)", () => {
        render(<PrivateQuantity value={1234} />)
        expect(screen.getByText("1,234")).toBeInTheDocument()
      })

      it("renders quantity with custom precision", () => {
        render(<PrivateQuantity value={1234.5678} precision={2} />)
        expect(screen.getByText("1,234.57")).toBeInTheDocument()
      })

      it("renders zero quantity", () => {
        render(<PrivateQuantity value={0} />)
        expect(screen.getByText("0")).toBeInTheDocument()
      })

      it("renders negative quantity", () => {
        render(<PrivateQuantity value={-100} />)
        expect(screen.getByText("-100")).toBeInTheDocument()
      })
    })

    describe("when privacy mode is enabled", () => {
      beforeEach(() => {
        usePrivacyMode.mockReturnValue({
          hideValues: true,
          toggleHideValues: jest.fn(),
        })
      })

      it("renders hidden placeholder", () => {
        render(<PrivateQuantity value={1234} />)
        expect(screen.getByText("****")).toBeInTheDocument()
        expect(screen.queryByText("1,234")).not.toBeInTheDocument()
      })

      it("renders hidden placeholder regardless of precision", () => {
        render(<PrivateQuantity value={1234.5678} precision={2} />)
        expect(screen.getByText("****")).toBeInTheDocument()
      })

      it("applies gray text color to hidden placeholder", () => {
        render(<PrivateQuantity value={1234} />)
        const hiddenElement = screen.getByText("****")
        expect(hiddenElement).toHaveClass("text-gray-400")
      })
    })
  })
})
