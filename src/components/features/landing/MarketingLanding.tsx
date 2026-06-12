import React, { useEffect, useRef } from "react"
import Link from "next/link"
import {
  HeroChart,
  NetWorthChart,
  ProjectionChart,
  AllocationRing,
} from "@components/features/landing/LandingCharts"

/**
 * Logged-out marketing landing. Explains the three pillars — Wealth,
 * Independence, Invest — each with a live, illustrative data-viz motif.
 *
 * Identity stays bc-view (DM Sans, mono figures, capability hues, flat
 * surfaces); the brand-marketing departure is scale, the drenched slate hero,
 * and one orchestrated self-draw reveal per section.
 */

/**
 * Adds `ld-animate` to the element the first time it scrolls into view, which
 * fires the SVG self-draw. The chart is fully drawn without the class, so this
 * only ever enhances an already-visible default (reduced-motion + headless
 * renderers keep the complete chart).
 */
function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return () => {}
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("ld-animate")
      return () => {}
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("ld-animate")
            obs.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.35 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

interface Pillar {
  key: "wealth" | "independence" | "invest"
  eyebrow: string
  question: string
  title: string
  body: string
  points: string[]
  href: string
  chart: React.ReactNode
  /** Tinted panel that holds the chart. */
  panel: string
  accent: string
  dot: string
  ring: string
}

const PILLARS: Pillar[] = [
  {
    key: "wealth",
    eyebrow: "Wealth",
    question: "What do I have?",
    title: "See everything you own, in one number.",
    body: "Net worth across brokers, assets and currencies — converted, reconciled, and kept current so the figure you see is the figure you trust.",
    points: ["Multi-currency", "Multi-broker", "Multi-asset"],
    href: "/learn/wealth",
    chart: <NetWorthChart />,
    panel: "bg-wealth-50",
    accent: "text-wealth-700",
    dot: "bg-wealth-500",
    ring: "focus-visible:ring-wealth-500",
  },
  {
    key: "independence",
    eyebrow: "Independence",
    question: "What do I want?",
    title: "Find the day work becomes optional.",
    body: "Project your wealth against the income your life needs. Model withdrawal strategies and inflation, then watch for the point your plan crosses the freedom line.",
    points: [
      "Withdrawal strategies",
      "Inflation modelling",
      "FIRE calculations",
    ],
    href: "/learn/independence",
    chart: <ProjectionChart />,
    panel: "bg-independence-50",
    accent: "text-independence-700",
    dot: "bg-independence-500",
    ring: "focus-visible:ring-independence-500",
  },
  {
    key: "invest",
    eyebrow: "Invest",
    question: "How do I get there?",
    title: "Turn goals into a model you can hold to.",
    body: "Shape a target allocation, invest new cash against it, and rebalance back to plan — so strategy survives contact with a moving market.",
    points: ["Model portfolios", "Invest cash to model", "Rebalance to target"],
    href: "/learn/strategy",
    chart: <AllocationRing />,
    panel: "bg-invest-50",
    accent: "text-invest-700",
    dot: "bg-invest-500",
    ring: "focus-visible:ring-invest-500",
  },
]

function PillarSection({
  pillar,
  flip,
}: {
  pillar: Pillar
  flip: boolean
}): React.ReactElement {
  const ref = useReveal<HTMLDivElement>()
  return (
    <section
      ref={ref}
      aria-labelledby={`pillar-${pillar.key}`}
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <div
        className={`grid items-center gap-10 md:grid-cols-2 ${
          flip ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Copy */}
        <div>
          <p
            className={`flex items-center gap-2 text-sm font-semibold ${pillar.accent}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${pillar.dot}`}
              aria-hidden="true"
            />
            {pillar.eyebrow}
          </p>
          <h2
            id={`pillar-${pillar.key}`}
            className="mt-2 text-pretty text-2xl font-bold leading-tight text-gray-900 sm:text-3xl"
          >
            <span className="block text-gray-500">{pillar.question}</span>
            {pillar.title}
          </h2>
          <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-gray-600">
            {pillar.body}
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {pillar.points.map((p) => (
              <li
                key={p}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <i
                  className={`fas fa-check text-xs ${pillar.accent}`}
                  aria-hidden="true"
                ></i>
                {p}
              </li>
            ))}
          </ul>
          <Link
            href={pillar.href}
            className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold ${pillar.accent} hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${pillar.ring} rounded`}
          >
            Learn more
            <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
          </Link>
        </div>
        {/* Chart panel */}
        <div className={`rounded-2xl ${pillar.panel} p-6 sm:p-8`}>
          {pillar.chart}
        </div>
      </div>
    </section>
  )
}

export default function MarketingLanding(): React.ReactElement {
  const heroRef = useReveal<HTMLDivElement>()
  return (
    <main className="min-h-screen bg-white">
      {/* Hero — drenched slate, the brand's frame color extended */}
      <header className="relative overflow-hidden bg-gray-900 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          <div>
            <h1 className="text-balance text-[clamp(2.25rem,5.5vw,3.75rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              Your whole financial picture, kept honest.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-300">
              Beancounter connects what you have, what you want, and how you get
              there — across every broker, asset and currency. Start anywhere;
              everything connects over time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                Sign in
              </Link>
              <a
                href="#pillars"
                className="text-sm font-medium text-gray-300 underline-offset-4 hover:text-white hover:underline"
              >
                See how it works
              </a>
            </div>
            <p className="mt-10 font-mono text-xs text-gray-400">
              Figures shown throughout are illustrative.
            </p>
          </div>
          {/* Hero visual — balances the headline on wide viewports. */}
          <div
            ref={heroRef}
            className="hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 lg:block"
          >
            <HeroChart />
          </div>
        </div>
      </header>

      {/* Pillars */}
      <div id="pillars" className="divide-y divide-gray-100">
        {PILLARS.map((pillar, i) => (
          <PillarSection key={pillar.key} pillar={pillar} flip={i % 2 === 1} />
        ))}
      </div>

      {/* Connector / closing CTA */}
      <section className="bg-gray-50">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-balance text-2xl font-bold text-gray-900 sm:text-3xl">
            Start anywhere. Everything connects over time.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-600">
            One ledger for wealth, independence and strategy — so today&apos;s
            decisions and tomorrow&apos;s plan stay in the same view.
          </p>
          <Link
            href="/auth/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Get started
            <i className="fas fa-arrow-right text-xs" aria-hidden="true"></i>
          </Link>
        </div>
      </section>
    </main>
  )
}
