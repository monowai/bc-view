import React from "react"
import { render, screen } from "@testing-library/react"
import JourneyRibbon from "../ribbons/JourneyRibbon"
import type { JourneyRibbonData } from "@lib/independence/journeyRibbon"

function makeData(
  overrides: Partial<JourneyRibbonData> = {},
): JourneyRibbonData {
  return {
    cells: [],
    verdict: "Money lasts to age 90+",
    verdictTone: "good",
    ...overrides,
  }
}

describe("JourneyRibbon", () => {
  describe("verdict pill", () => {
    it("renders good verdict with check glyph", () => {
      render(
        <JourneyRibbon
          data={makeData({
            verdictTone: "good",
            verdict: "Money lasts to age 90+",
          })}
        />,
      )
      expect(screen.getByText(/Money lasts to age 90\+/)).toBeInTheDocument()
    })

    it("renders warn verdict", () => {
      render(
        <JourneyRibbon
          data={makeData({
            verdictTone: "warn",
            verdict: "Savings run out at 82 — 8 years short",
          })}
        />,
      )
      expect(screen.getByText(/8 years short/)).toBeInTheDocument()
    })

    it("renders bad verdict", () => {
      render(
        <JourneyRibbon
          data={makeData({
            verdictTone: "bad",
            verdict: "Savings run out at 82 — 8 years short",
          })}
        />,
      )
      expect(screen.getByText(/8 years short/)).toBeInTheDocument()
    })

    it("bad verdict uses ✗ glyph distinct from warn ⚠", () => {
      const { container: warnContainer } = render(
        <JourneyRibbon
          data={makeData({ verdictTone: "warn", verdict: "Warn" })}
        />,
      )
      const { container: badContainer } = render(
        <JourneyRibbon
          data={makeData({ verdictTone: "bad", verdict: "Bad" })}
        />,
      )
      const warnGlyph = warnContainer.querySelector("span span")?.textContent
      const badGlyph = badContainer.querySelector("span span")?.textContent
      expect(warnGlyph).toBe("⚠")
      expect(badGlyph).toBe("✗")
      expect(warnGlyph).not.toBe(badGlyph)
    })
  })

  describe("ribbon row", () => {
    it("renders one cell per age", () => {
      const data = makeData({
        cells: [
          {
            age: 45,
            status: "building",
            note: "Age 45 — building",
            isAccumulation: true,
          },
          {
            age: 46,
            status: "building",
            note: "Age 46 — building",
            isAccumulation: true,
          },
          {
            age: 60,
            status: "covered",
            note: "Age 60 — income covers expenses",
            isAccumulation: false,
          },
        ],
      })
      const { container } = render(<JourneyRibbon data={data} />)
      // Each cell has a title attribute
      const cells = container.querySelectorAll("[title]")
      expect(cells).toHaveLength(3)
    })

    it("each cell has a title tooltip matching the note", () => {
      const data = makeData({
        cells: [
          {
            age: 45,
            status: "building",
            note: "Age 45 — building wealth: saving and growing",
            isAccumulation: true,
          },
        ],
      })
      const { container } = render(<JourneyRibbon data={data} />)
      const cell = container.querySelector("[title]")
      expect(cell?.getAttribute("title")).toContain("Age 45")
    })

    it("row has role=img for accessibility", () => {
      render(
        <JourneyRibbon
          data={makeData({ verdict: "Money lasts to age 90+" })}
        />,
      )
      expect(screen.getByRole("img")).toBeInTheDocument()
    })

    it("row aria-label summarizes the verdict", () => {
      render(
        <JourneyRibbon
          data={makeData({
            verdict: "Money lasts to age 90+",
            verdictTone: "good",
          })}
        />,
      )
      const img = screen.getByRole("img")
      expect(img.getAttribute("aria-label")).toContain("Money lasts to age 90+")
    })
  })

  describe("legend", () => {
    it("shows only statuses present in data", () => {
      const data = makeData({
        cells: [
          { age: 45, status: "building", note: "", isAccumulation: true },
          { age: 65, status: "covered", note: "", isAccumulation: false },
        ],
      })
      render(<JourneyRibbon data={data} />)
      expect(screen.getByText(/Building/i)).toBeInTheDocument()
      expect(screen.getByText(/Income covered/i)).toBeInTheDocument()
      // statuses not in data should not appear
      expect(screen.queryByText(/Shortfall/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Thinning/i)).not.toBeInTheDocument()
    })

    it("shows all five statuses when all present", () => {
      const data = makeData({
        cells: [
          { age: 45, status: "building", note: "", isAccumulation: true },
          { age: 65, status: "covered", note: "", isAccumulation: false },
          { age: 70, status: "onTrack", note: "", isAccumulation: false },
          { age: 78, status: "thinning", note: "", isAccumulation: false },
          { age: 84, status: "shortfall", note: "", isAccumulation: false },
        ],
      })
      render(<JourneyRibbon data={data} />)
      expect(screen.getByText(/Building/i)).toBeInTheDocument()
      expect(screen.getByText(/Income covered/i)).toBeInTheDocument()
      expect(screen.getByText(/On track/i)).toBeInTheDocument()
      expect(screen.getByText(/Thinning/i)).toBeInTheDocument()
      expect(screen.getByText(/Shortfall/i)).toBeInTheDocument()
    })
  })

  describe("empty state", () => {
    it("renders without crashing when cells is empty", () => {
      const { container } = render(
        <JourneyRibbon data={makeData({ cells: [] })} />,
      )
      expect(container).toBeTruthy()
    })
  })
})
