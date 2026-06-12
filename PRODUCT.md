# Product

## Register

product

## Users

Serious investors managing real money — both **DIY self-directed individuals**
and **advisors / professionals**. They arrive with intent: check what a
portfolio is worth, see gain/loss, rebalance toward a model, plan financial
independence, reconcile transactions. Context is focused and recurring (a
weekly or monthly check-in, not idle browsing), often on desktop but
increasingly mobile. They tolerate density when it earns its place, but they
are not all spreadsheet-natives — the UI must stay legible to a careful retail
investor while remaining fast for a pro.

## Product Purpose

bc-view is the frontend for the Beancounter ecosystem: portfolios and
transactions (svc-data), holdings and valuations (svc-position), corporate
events (svc-event), financial-independence / retirement projections
(svc-retire), and portfolio rebalancing (svc-rebalance). It turns scattered
brokerage activity into one truthful picture of wealth — current value,
realised and unrealised gain/loss, allocation, projected independence, and the
milestones along the way.

Success = the user trusts the numbers without second-guessing them, finds the
one figure they came for in seconds, and leaves with a clear next action
(rebalance, settle a trade, adjust a plan). The tool should disappear into the
task.

## Brand Personality

**Calm, trustworthy, precise.** Quiet confidence around money — financial
gravity without anxiety. Voice is plain and exact: real figures, honest
gain/loss, no vanity metrics or growth-hype. Tabular numerals, consistent
component vocabulary, and restraint signal "your money is handled carefully."
Delight is reserved for moments (a milestone reached), never sprayed across
pages.

## Anti-references

- **Legacy bank / brokerage** — cluttered gray-on-gray tables, dated chrome,
  density without care (e-Trade / IB). Density here must always be deliberate.
- **Crypto / meme hype** — neon gradients, gamified dopamine, confetti, casino
  energy (Robinhood). Money is serious; the UI never gambles for attention.
- **Spreadsheet / enterprise** — Excel-grid feel with no hierarchy, Bloomberg-
  terminal intimidation. Data-dense views still need a clear primary figure and
  scannable structure.
- Plus the shared AI-slop tells: hero-metric template, gradient text, identical
  icon-card grids, eyebrow kickers on every section.

## Design Principles

1. **Trust through precision.** Exact, honest numbers — tabular nums, real
   gain/loss, no rounding that flatters. Accuracy is the brand.
2. **Calm under financial gravity.** Restraint over stimulation. No dopamine
   mechanics, no urgency theatre; the user should feel steady, not anxious.
3. **Earned familiarity.** Standard affordances (tables, tabs, side nav,
   forms) done well beat invented ones. The tool disappears into the task.
4. **Progressive depth.** Approachable defaults for the careful DIY investor;
   density and power features available, not forced. One surface serves both
   the retail user and the pro.
5. **Honest signal, semantic color.** Color carries meaning — gain/loss,
   capability domains (wealth / independence / invest) — never decoration.

## Accessibility & Inclusion

No formal conformance target committed; follow strong defaults as the floor:

- Body-text contrast ≥ 4.5:1; honour the existing token ramp rather than light
  gray "for elegance."
- Keyboard-operable controls and visible focus states.
- `prefers-reduced-motion` alternative for every animation.
- Gain/loss must not rely on red/green hue alone (sign, arrows, or labels)
  given the investor audience and color-blindness prevalence.
