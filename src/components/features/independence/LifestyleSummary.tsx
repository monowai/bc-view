import React, { ReactNode, useId } from "react"
import { formatCurrency } from "@lib/independence/formatters"
import {
  COMFORT_SCALE_MAX,
  headroomPhrase,
  type LifestyleSummaryModel,
  type LifestyleCategory,
} from "@lib/independence/lifestyleSummary"

/**
 * The lifestyle mood board: what a plan supports, read as a life rather than a
 * lump sum. A comfort band up top, then a tile per category — icon, name,
 * amount — tinted by its share of the spend, so the shape of the life lands
 * before any of the numbers are read.
 *
 * Two variants, one component. `payoff` is the end-of-onboarding moment —
 * saturated, animated, the one place this product raises its voice. `panel`
 * is the same board sitting quietly inside the plan view, where the user is
 * working rather than being told something.
 */

const HIDDEN_VALUE = "****"
const STAGGER_MS = 45

export interface LifestyleSummaryProps {
  model: LifestyleSummaryModel | null
  currencySymbol?: string
  /** Privacy mode. Masks amounts; the board stays, since a proportion is not a figure. */
  hideValues?: boolean
  variant?: "payoff" | "panel"
  isLoading?: boolean
  /** Overrides the heading. Used where the caller names the surface itself
   *  (a composite phase, say) rather than the plan as a whole. */
  title?: string
  /** Shown in place of the board when there is no model. */
  emptyMessage?: string
  /** Optional control rendered beside the heading — e.g. an edit link for the
   *  plan this board describes. Kept out of the heading text so the accessible
   *  name stays the phase, not the phase plus a verb. */
  action?: ReactNode
}

export default function LifestyleSummary({
  model,
  currencySymbol = "$",
  hideValues = false,
  variant = "panel",
  isLoading = false,
  title,
  emptyMessage = "Add what you expect to spend and we'll show the lifestyle your plan supports.",
  action,
}: LifestyleSummaryProps): React.ReactElement {
  const isPayoff = variant === "payoff"
  const headingId = useId()
  // Rounded to whole units: the tile amounts are already whole (allocate()
  // rounds them), and the Summary tab's "Sustainable spending" tile shows the
  // same figure rounded. Cents made the headline disagree with both.
  const money = (v: number): string =>
    hideValues ? HIDDEN_VALUE : formatCurrency(Math.round(v), currencySymbol)

  return (
    <section
      aria-labelledby={headingId}
      className={
        isPayoff
          ? "rounded-2xl bg-independence-700 px-6 py-6 text-white sm:px-8 sm:py-7"
          : "rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Heading
          id={headingId}
          isPayoff={isPayoff}
          text={headingText(model, title)}
        />
        {action}
      </div>

      {isLoading ? (
        <Skeleton isPayoff={isPayoff} />
      ) : !model ? (
        <p
          className={`mt-3 text-sm ${
            isPayoff ? "text-white/80" : "text-gray-600 dark:text-gray-300"
          }`}
        >
          {emptyMessage}
        </p>
      ) : (
        <>
          <Headline model={model} isPayoff={isPayoff} money={money} />
          {model.comfort && <Comfort model={model} isPayoff={isPayoff} />}
          {/* auto-fit rather than fixed columns: the same board has to work in
              a narrow onboarding step and a full-width plan card. */}
          <ol className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2.5">
            {model.categories.map((category, index) => (
              <Tile
                key={category.categoryName}
                category={category}
                index={index}
                isPayoff={isPayoff}
                money={money}
              />
            ))}
          </ol>
          <Footnotes model={model} isPayoff={isPayoff} money={money} />
        </>
      )}
    </section>
  )
}

/**
 * A described-basis model makes no affordability claim, so it must not be
 * headed as though it did — "what your plan supports" would be asserting
 * exactly the thing the backend didn't tell us.
 */
export function headingText(
  model: LifestyleSummaryModel | null,
  title?: string,
): string {
  if (title) return title
  return model?.basis === "described"
    ? "What this costs"
    : "What your plan supports"
}

/**
 * The payoff screen owns its page, so it heads at h2. The panel sits among
 * the plan view's h3 section headings — matching them keeps the document
 * outline intact rather than punching a hole in it for styling's sake.
 */
function Heading({
  id,
  isPayoff,
  text,
}: {
  id: string
  isPayoff: boolean
  text: string
}): React.ReactElement {
  return isPayoff ? (
    <h2 id={id} className="text-base font-semibold text-white/90">
      {text}
    </h2>
  ) : (
    <h3
      id={id}
      className="text-sm font-semibold text-gray-900 dark:text-gray-100"
    >
      {text}
    </h3>
  )
}

interface ValueProps {
  model: LifestyleSummaryModel
  isPayoff: boolean
  money: (v: number) => string
}

function Headline({ model, isPayoff, money }: ValueProps): React.ReactElement {
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p
        className={`tabular-nums font-bold ${
          isPayoff
            ? "text-4xl text-white sm:text-5xl"
            : "text-2xl text-gray-900 dark:text-gray-50"
        }`}
      >
        {money(model.monthlyTotal)}
        <span
          className={`ml-1.5 font-normal ${
            isPayoff
              ? "text-base text-white/70"
              : "text-sm text-gray-500 dark:text-gray-400"
          }`}
        >
          / month
        </span>
      </p>
      <Adjustment model={model} isPayoff={isPayoff} />
    </div>
  )
}

/**
 * The comfort read: a word, a filled scale, and — crucially — what the gap is
 * worth in the user's own categories.
 *
 * "Generous" alone would be claiming an absolute standard of living, which
 * nothing in the data supports. "Generous — everything you planned for, plus
 * two-thirds of your Entertainment budget spare" says the same thing in
 * language people use, and every word of it is arithmetic on figures the user
 * supplied. The sentence is what earns the label.
 */
function Comfort({
  model,
  isPayoff,
}: {
  model: LifestyleSummaryModel
  isPayoff: boolean
}): React.ReactElement | null {
  const comfort = model.comfort
  if (!comfort) return null
  // On the described basis the total IS the described total, so the phrase
  // would always be "just about exactly the life you described" — true,
  // vacuous, and it makes the comfort band look like it's about headroom when
  // it's a summary of the breakdown.
  const phrase = model.basis === "supported" ? headroomPhrase(model) : null

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`text-sm font-semibold ${
            isPayoff ? "text-white" : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {/* "lifestyle" is doing real work: the band rates the standard of
              living the breakdown describes, while the sentence below rates
              whether the plan can pay for it. Without the noun, "Generous"
              sitting above "the plan falls short" reads as a contradiction
              rather than as two different facts. */}
          {comfort.label} lifestyle
        </span>
        <span
          className="flex items-center gap-[3px]"
          role="img"
          aria-label={`${comfort.label}: ${comfort.score} out of ${COMFORT_SCALE_MAX}`}
        >
          {Array.from({ length: COMFORT_SCALE_MAX }, (_, index) => {
            const reached = index < comfort.score
            return (
              <span
                key={index}
                className={`h-1.5 w-3 rounded-full ${
                  isPayoff
                    ? reached
                      ? "bg-white"
                      : "bg-white/25"
                    : reached
                      ? "bg-independence-500"
                      : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )
          })}
        </span>
        <span
          className={`tabular-nums text-xs font-medium ${
            isPayoff ? "text-white/80" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {comfort.score}/{COMFORT_SCALE_MAX}
        </span>
      </div>
      {phrase && (
        <p
          className={`mt-1 text-sm ${
            isPayoff ? "text-white/80" : "text-gray-600 dark:text-gray-300"
          }`}
        >
          {capitalise(phrase)}.
        </p>
      )}
    </div>
  )
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function Adjustment({
  model,
  isPayoff,
}: {
  model: LifestyleSummaryModel
  isPayoff: boolean
}): React.ReactElement | null {
  if (model.adjustmentPercent == null || model.direction === "level")
    return null
  const magnitude = Math.abs(Math.round(model.adjustmentPercent))
  if (magnitude === 0) return null
  const label =
    model.direction === "headroom"
      ? `${magnitude}% more than you described`
      : `${magnitude}% less than you described`

  const tone = isPayoff
    ? "bg-white/15 text-white"
    : model.direction === "headroom"
      ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
      : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  )
}

/**
 * Tint carries the category's share of the spend. Deliberately not a bar:
 * strength of colour reads as "how much of this life is this" at a glance,
 * which is the mood board's job, while the amount underneath stays exact.
 */
function tintFor(share: number, isPayoff: boolean): string {
  const weight = Math.max(0, Math.min(1, share))
  return isPayoff
    ? `rgba(255, 255, 255, ${(0.1 + weight * 0.16).toFixed(3)})`
    : `rgba(249, 115, 22, ${(0.05 + weight * 0.15).toFixed(3)})`
}

function Tile({
  category,
  index,
  isPayoff,
  money,
}: {
  category: LifestyleCategory
  index: number
  isPayoff: boolean
  money: (v: number) => string
}): React.ReactElement {
  // A rounding-sized difference isn't worth a second line.
  const rescaled = Math.abs(category.amount - category.described) >= 1
  return (
    <li
      className={`flex flex-col gap-1 rounded-xl px-3 py-3 ${
        isPayoff ? "animate-tile-in" : ""
      }`}
      style={{
        backgroundColor: tintFor(category.share, isPayoff),
        ...(isPayoff ? { animationDelay: `${index * STAGGER_MS}ms` } : {}),
      }}
    >
      {/* The catalog carries the emoji, so the board and these tiles mark a
          category the same way. The rollup spans categories and has none. */}
      <span aria-hidden="true" className="text-base leading-none">
        {category.emoji ??
          (category.isRollup ? "\u00b7\u00b7\u00b7" : "\u2022")}
      </span>
      <span
        className={`truncate text-xs font-medium ${
          isPayoff
            ? category.isRollup
              ? "text-white/70"
              : "text-white/90"
            : category.isRollup
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-700 dark:text-gray-200"
        }`}
        title={category.categoryName}
      >
        {category.categoryName}
      </span>
      {/* What this level of spend actually buys. The benchmark is the point —
          "health insurance + gym" says more than SGD400 ever will. Where no
          band is authored we fall back to the category's own description, so
          the tile still says something. */}
      {(category.benchmark ?? category.description) && (
        <span
          className={`text-[0.6875rem] leading-snug ${
            isPayoff ? "text-white/60" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {category.benchmark ?? category.description}
        </span>
      )}
      <span
        className={`mt-auto pt-1 tabular-nums text-sm font-semibold ${
          isPayoff ? "text-white" : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {money(category.amount)}
      </span>
      {/* These figures are the described mix scaled to what the plan actually
          supports, so they don't match what was typed in. Without saying so,
          "Housing S$2,278" against a S$2,500 budget just looks like a bug. */}
      {rescaled && (
        <span
          className={`tabular-nums text-[0.6875rem] ${
            isPayoff ? "text-white/60" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          of {money(category.described)} planned
        </span>
      )}
    </li>
  )
}

function Footnotes({ model, isPayoff, money }: ValueProps): React.ReactElement {
  const muted = isPayoff ? "text-white/75" : "text-gray-600 dark:text-gray-300"
  return (
    <div className={`mt-4 space-y-1.5 text-sm ${muted}`}>
      {readSentence(model) && <p>{readSentence(model)}</p>}
      {model.liquidation && (
        <p
          className={
            isPayoff ? "text-white/60" : "text-gray-500 dark:text-gray-400"
          }
        >
          Selling illiquid assets lifts this to{" "}
          <span className="tabular-nums">
            {money(model.liquidation.supportedMonthly)}
          </span>
          /month
          {model.liquidation.fromAge != null
            ? ` from age ${model.liquidation.fromAge}`
            : ""}
          .
        </p>
      )}
    </div>
  )
}

/**
 * Describes the shape of the user's own mix and how it sits against the plan.
 * Says nothing about how many holidays the money buys — the backend supplies
 * no lifestyle benchmarks, and inventing them here would be fiction.
 */
export function readSentence(model: LifestyleSummaryModel): string | null {
  const mix = model.mixDescriptor
  // A described-basis model was built without a projection, so every phrasing
  // about what "the plan supports" is unearned. Name the mix and stop.
  // Same when the comfort read is present: it already states the headroom in
  // plainer words, and saying it twice makes neither land.
  if (model.basis === "described" || model.comfort)
    return mix ? `${mix}.` : null
  switch (model.direction) {
    case "headroom":
      return mix
        ? `${mix}, with room to spare.`
        : "Your plan supports more than you described."
    case "shortfall":
      return mix
        ? `${mix}, and running ahead of what the plan supports.`
        : "Your plan supports less than you described."
    default:
      return mix
        ? `${mix}, and the plan supports it.`
        : "Your plan supports the lifestyle you described."
  }
}

function Skeleton({ isPayoff }: { isPayoff: boolean }): React.ReactElement {
  const block = isPayoff ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800"
  return (
    <div className="mt-4 space-y-3" aria-hidden="true">
      <div className={`h-8 w-40 animate-pulse rounded ${block}`} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-20 animate-pulse rounded-xl ${block}`} />
        ))}
      </div>
    </div>
  )
}
