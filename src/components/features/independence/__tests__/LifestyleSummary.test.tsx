import React from "react"
import { render, screen, within } from "@testing-library/react"
import "@testing-library/jest-dom"
import LifestyleSummary from "../LifestyleSummary"
import type { LifestyleSummaryModel } from "@lib/independence/lifestyleSummary"

const model = (
  overrides: Partial<LifestyleSummaryModel> = {},
): LifestyleSummaryModel => ({
  basis: "supported",
  monthlyTotal: 5100,
  describedMonthly: 4600,
  adjustmentPercent: 11,
  direction: "headroom",
  categories: [
    {
      categoryName: "Housing",
      categoryLabelId: "cat-Housing",
      emoji: "\u{1F3E0}",
      description: "Rates, management fees, insurance, maintenance",
      described: 2000,
      amount: 2200,
      share: 1,
      isRollup: false,
    },
    {
      categoryName: "Travel",
      categoryLabelId: "cat-Travel",
      emoji: "\u2708\uFE0F",
      described: 1000,
      amount: 1100,
      share: 0.5,
      isRollup: false,
    },
    {
      categoryName: "Everything else",
      categoryLabelId: "",
      described: 1600,
      amount: 1800,
      share: 0.82,
      isRollup: true,
    },
  ],
  mixDescriptor: "Housing-heavy",
  liquidation: null,
  comfort: {
    key: "comfortable",
    label: "Comfortable",
    step: 3,
    score: 6,
    basedOn: 3,
  },
  ...overrides,
})

describe("LifestyleSummary", () => {
  it("leads with the monthly figure the plan supports", () => {
    render(<LifestyleSummary model={model()} />)
    expect(screen.getByText("$5,100")).toBeInTheDocument()
    expect(screen.getByText("/ month")).toBeInTheDocument()
  })

  it("lists every category with its supported amount", () => {
    render(<LifestyleSummary model={model()} />)
    expect(screen.getByText("Housing")).toBeInTheDocument()
    expect(screen.getByText("$2,200")).toBeInTheDocument()
    expect(screen.getByText("Everything else")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
  })

  it("uses the caller's currency symbol", () => {
    render(<LifestyleSummary model={model()} currencySymbol="NZ$" />)
    expect(screen.getByText("NZ$5,100")).toBeInTheDocument()
  })

  it("states how the figure compares to what was described", () => {
    render(<LifestyleSummary model={model()} />)
    expect(screen.getByText("11% more than you described")).toBeInTheDocument()
  })

  it("phrases a shortfall without scolding", () => {
    render(
      <LifestyleSummary
        model={model({
          direction: "shortfall",
          adjustmentPercent: -18,
          comfort: null,
        })}
      />,
    )
    expect(screen.getByText("18% less than you described")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Housing-heavy, and running ahead of what the plan supports.",
      ),
    ).toBeInTheDocument()
  })

  it("does not state the headroom twice when the comfort read is shown", () => {
    render(<LifestyleSummary model={model()} />)
    expect(screen.getByText("Housing-heavy.")).toBeInTheDocument()
    expect(screen.queryByText(/with room to spare/)).not.toBeInTheDocument()
  })

  it("says nothing about the comparison when it is level", () => {
    render(<LifestyleSummary model={model({ direction: "level" })} />)
    expect(screen.queryByText(/than you described/)).not.toBeInTheDocument()
  })

  it("surfaces the with-liquidation figure when there is one", () => {
    render(
      <LifestyleSummary
        model={model({
          liquidation: { supportedMonthly: 6300, fromAge: 71 },
        })}
      />,
    )
    expect(
      screen.getByText(/Selling illiquid assets lifts this to/),
    ).toBeInTheDocument()
    expect(screen.getByText("$6,300")).toBeInTheDocument()
    expect(screen.getByText(/from age 71/)).toBeInTheDocument()
  })

  describe("privacy mode", () => {
    it("masks every figure but keeps the board", () => {
      render(<LifestyleSummary model={model()} hideValues />)
      expect(screen.queryByText("$5,100")).not.toBeInTheDocument()
      expect(screen.queryByText("$2,200")).not.toBeInTheDocument()
      expect(screen.getAllByText("****").length).toBeGreaterThan(1)
      // Categories and their weighting are shape, not figures, and the board
      // is useless without them.
      expect(screen.getAllByRole("listitem")).toHaveLength(3)
      expect(screen.getByText("Housing")).toBeInTheDocument()
    })
  })

  describe("the comfort read", () => {
    it("names the band and marks its place on the scale", () => {
      render(<LifestyleSummary model={model()} />)
      expect(screen.getByText("Comfortable lifestyle")).toBeInTheDocument()
      expect(
        screen.getByRole("img", { name: /Comfortable: 6 out of 10/ }),
      ).toBeInTheDocument()
      expect(screen.getByText("6/10")).toBeInTheDocument()
    })

    it("says what the gap is worth in the user's own categories", () => {
      // The label alone would claim an absolute standard of living. This
      // sentence is what earns it — and it's arithmetic on the user's figures.
      render(<LifestyleSummary model={model()} />)
      expect(
        screen.getByText(/and about .* Travel budget spare/),
      ).toBeInTheDocument()
    })

    it("rates the lifestyle, not the affordability", () => {
      // A generous lifestyle the plan can't quite fund is two facts, not a
      // contradiction — but only if the band says what it is rating.
      render(
        <LifestyleSummary
          model={model({
            direction: "shortfall",
            adjustmentPercent: -9,
            monthlyTotal: 4100,
            describedMonthly: 4600,
          })}
        />,
      )
      expect(screen.getByText("Comfortable lifestyle")).toBeInTheDocument()
      expect(screen.getByText(/falls short/)).toBeInTheDocument()
    })

    it("drops the headroom line on the described basis", () => {
      // Total and described total are the same number there, so the phrase
      // could only ever say "just about exactly the life you described".
      render(<LifestyleSummary model={model({ basis: "described" })} />)
      expect(screen.getByText("Comfortable lifestyle")).toBeInTheDocument()
      expect(
        screen.queryByText(/exactly the life you described/),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/budget spare/)).not.toBeInTheDocument()
    })

    it("stays silent when there is no comfort to report", () => {
      render(<LifestyleSummary model={model({ comfort: null })} />)
      expect(
        screen.queryByText(/Comfortable lifestyle/),
      ).not.toBeInTheDocument()
    })
  })

  describe("the mood board", () => {
    it("says what the spend buys, in preference to what the bucket covers", () => {
      render(
        <LifestyleSummary
          model={model({
            categories: [
              {
                categoryName: "Healthcare",
                categoryLabelId: "cat-Healthcare",
                benchmark: "health insurance + gym",
                description: "Medical, dental, vision, insurance",
                described: 400,
                amount: 400,
                share: 1,
                isRollup: false,
              },
            ],
          })}
        />,
      )
      expect(screen.getByText("health insurance + gym")).toBeInTheDocument()
      expect(
        screen.queryByText("Medical, dental, vision, insurance"),
      ).not.toBeInTheDocument()
    })

    it("falls back to the description where no band is authored", () => {
      render(<LifestyleSummary model={model()} />)
      expect(
        screen.getByText("Rates, management fees, insurance, maintenance"),
      ).toBeInTheDocument()
    })

    it("shows what was planned whenever the figure has been rescaled", () => {
      // The tiles are the described mix scaled to what the plan supports, so
      // "Housing S$2,278" against a S$2,500 budget reads as a bug unless the
      // rescaling is stated.
      render(<LifestyleSummary model={model()} />)
      expect(screen.getByText("of $2,000 planned")).toBeInTheDocument()
    })

    it("stays quiet when the figure is the one that was planned", () => {
      render(
        <LifestyleSummary
          model={model({
            basis: "described",
            categories: [
              {
                categoryName: "Housing",
                categoryLabelId: "cat-Housing",
                described: 2000,
                amount: 2000,
                share: 1,
                isRollup: false,
              },
            ],
          })}
        />,
      )
      expect(screen.queryByText(/planned/)).not.toBeInTheDocument()
    })

    it("marks each category with the catalog's emoji", () => {
      // The catalog owns these, so the board and these tiles agree.
      render(<LifestyleSummary model={model()} />)
      expect(screen.getByText("\u{1F3E0}")).toBeInTheDocument()
      expect(screen.getByText("\u2708\uFE0F")).toBeInTheDocument()
      // The rollup spans categories, so it has no emoji of its own.
      expect(screen.getByText("\u00b7\u00b7\u00b7")).toBeInTheDocument()
    })

    it("weights each tile's tint by its share of the spend", () => {
      const { container } = render(<LifestyleSummary model={model()} />)
      const tiles = container.querySelectorAll<HTMLElement>("li")
      // Housing (share 1) sits stronger than Travel (share 0.5).
      const alpha = (el: HTMLElement): number =>
        Number(el.style.backgroundColor.match(/[\d.]+\)$/)?.[0].slice(0, -1))
      expect(alpha(tiles[0])).toBeGreaterThan(alpha(tiles[1]))
    })
  })

  describe("heading", () => {
    it("claims support only on the supported basis", () => {
      render(<LifestyleSummary model={model()} />)
      expect(
        screen.getByRole("heading", { name: "What your plan supports" }),
      ).toBeInTheDocument()
    })

    it("drops the affordability claim on the described basis", () => {
      // The composite projection gives no sustainable figure — heading the
      // panel "what your plan supports" would assert what wasn't measured.
      render(
        <LifestyleSummary
          model={model({ basis: "described", adjustmentPercent: null })}
        />,
      )
      expect(
        screen.queryByRole("heading", { name: "What your plan supports" }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "What this costs" }),
      ).toBeInTheDocument()
    })

    it("never claims support in the read-out on the described basis", () => {
      render(<LifestyleSummary model={model({ basis: "described" })} />)
      expect(screen.getByText("Housing-heavy.")).toBeInTheDocument()
      expect(screen.queryByText(/plan supports/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/room to spare/i)).not.toBeInTheDocument()
    })

    it("lets the caller name the surface", () => {
      render(
        <LifestyleSummary
          model={model({ basis: "described" })}
          title="Slow-go · age 70–80"
        />,
      )
      expect(
        screen.getByRole("heading", { name: "Slow-go · age 70–80" }),
      ).toBeInTheDocument()
    })
  })

  describe("variants", () => {
    it("heads the payoff at h2 — it owns the screen", () => {
      render(<LifestyleSummary model={model()} variant="payoff" />)
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /what your plan supports/i,
        }),
      ).toBeInTheDocument()
    })

    it("heads the panel at h3 to sit among the plan view's sections", () => {
      render(<LifestyleSummary model={model()} variant="panel" />)
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: /what your plan supports/i,
        }),
      ).toBeInTheDocument()
    })

    it("animates tiles on the payoff only", () => {
      const { container: payoff } = render(
        <LifestyleSummary model={model()} variant="payoff" />,
      )
      expect(payoff.querySelectorAll(".animate-tile-in")).toHaveLength(3)

      const { container: panel } = render(
        <LifestyleSummary model={model()} variant="panel" />,
      )
      expect(panel.querySelectorAll(".animate-tile-in")).toHaveLength(0)
    })

    it("staggers the payoff reveal", () => {
      const { container } = render(
        <LifestyleSummary model={model()} variant="payoff" />,
      )
      const tiles = container.querySelectorAll<HTMLElement>(".animate-tile-in")
      expect(tiles[0].style.animationDelay).toBe("0ms")
      expect(tiles[1].style.animationDelay).not.toBe("0ms")
    })
  })

  describe("without a model", () => {
    it("teaches the user what to do instead of showing nothing", () => {
      render(<LifestyleSummary model={null} />)
      expect(
        screen.getByText(/Add what you expect to spend/i),
      ).toBeInTheDocument()
    })

    it("accepts a caller-supplied message", () => {
      render(<LifestyleSummary model={null} emptyMessage="Nothing yet." />)
      expect(screen.getByText("Nothing yet.")).toBeInTheDocument()
    })

    it("shows skeleton bars while loading, not a spinner", () => {
      render(<LifestyleSummary model={null} isLoading />)
      expect(screen.queryByText(/Add what you expect/i)).not.toBeInTheDocument()
      expect(screen.queryByRole("listitem")).not.toBeInTheDocument()
    })
  })

  it("keeps the heading available to assistive tech", () => {
    render(<LifestyleSummary model={model()} />)
    const region = screen.getByRole("region", {
      name: /what your plan supports/i,
    })
    expect(within(region).getByText("Housing")).toBeInTheDocument()
  })
})
