# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People building toward or who have achieved financial independence through active asset accumulation — not pensions, not passive-income businesses. The spectrum runs from "curious early-stage investor trying to understand their number" to "Mike, already FI, refining the model." Users understand their own money but may not know FIRE jargon (blended return rate, FI number, SORR). They are task-oriented and expect the tool to guide them, not just display data. Don't assume financial literacy; assume intelligence.

Today the users are the author and the people he invites, who see portfolios and plans through sharing. The product is built to become public: every feature must work for a stranger who signs up, not only for the author.

## Product Purpose

Beancounter is a personal financial independence planning and tracking tool. It turns a messy portfolio of assets, income streams, and future plans into a clear answer: "Can I stop working? When? What does my wealth look like over time?" Success means the user leaves a session with more confidence in a decision — either to act or to wait.

## Positioning

Three claims a spreadsheet, robo-advisor or FIRE calculator cannot honestly make together:

- **Everything in one place.** Listed shares, private assets, property, bank accounts and pensions such as CPF, across currencies, valued together.
- **The plan is tied to actuals.** Trades, payslips, monthly spend and the bank withdrawals that pay for it feed the plan, so the projection follows what actually happened.
- **A phased independence plan.** A journey through life phases (working, Go-Go, Slow-Go and the rest) judged by Monte Carlo odds, not a single FI number.

Not a confirmed claim: that the model is fully transparent or inspectable. Do not market it that way.

## Operating Context

From the repository; these are the workflows that exist today:

- Holdings arrive by entering trades, importing broker statements or images, and setting balances on bank accounts.
- Income arrives through payslips (with CPF contributions); spending through a monthly spend log by category, which can post one withdrawal a month from a chosen bank account.
- Values are converted across currencies at FX rates; the Net Worth page totals everything.
- Independence plans hold phases, expenses by category, Monte Carlo runs, and a retired mode once the plan's retirement date has passed.
- An AI chat assistant answers questions about portfolios and plans for users with AI access.
- Watchlists, rebalance models and news sit alongside.

## Capabilities and Constraints

- Multi-currency throughout; a user's spend log is locked to one currency.
- User data is owned by the user's account (`SystemUser.id`) and can be shared with invited people.
- Privacy mode hides values on screen; zen mode simplifies the interface for a single portfolio.
- Undecided: public sign-up, pricing and any plan tiers.

## Brand Commitments

Calm, precise, helpful. Not a wellness app, not a robo-advisor. The tool assumes intelligence but not domain knowledge. It explains what matters and why, surfaces the right number at the right moment, and gets out of the way. It should feel like a very organised friend who understands money — not a bank dashboard or a startup growth tool.

## Anti-references

- Ramsey Solutions / personal-finance guilt-trip aesthetic — moralising, prescriptive, oversimplified
- Wealthsimple / Acorns consumer fintech sweetness — too soft, rounds off precision
- Bloomberg terminal — too dense, intimidating, impersonal
- SaaS dashboard cliché — hero metric cards, gradient accents, section eyebrows, identical card grids
- Betterment / robo-advisor wellness palette — teal/green, round friendly UI that hides the numbers

## Evidence on Hand

- Demo and seed data exist for showcases (the README's Compose/DEMO build).
- No testimonials, user quotes, press, benchmarks or user counts exist. Never invent them.

## Product Principles

1. **The whole picture beats a partial one.** Everything a user owns belongs in Beancounter, valued in one currency, before any single figure is trusted.
2. **Actuals keep the plan honest.** What happened (trades, payslips, spend, withdrawals) feeds the projection; anything the system estimates is labelled as estimated.
3. **Plan in phases, judge by odds.** Independence is a sequence of life phases with a probability of lasting, not one target number.
4. **Built for a stranger.** A feature is finished when someone who is not the author can use it without help.

## Design Principles

1. **Total first, detail on demand.** The single number that matters (total expenses, liquid balance, FI progress) leads every section. Breakdown is context, never the answer.
2. **Explain while you ask.** Every input should show why it matters to the projection. Labelling "Monthly expenses" is not enough; a one-liner on how it drives the FI number closes the gap between input and outcome.
3. **Helpful, not clever.** Clear language over jargon. "Money you can spend" over "liquid assets" where context allows. Detail is there for the curious, hidden for the first-timer.
4. **Consistency over surprise.** Same form controls, same button shape, same number formatting everywhere. In a financial planning tool, visual inconsistency reads as data inconsistency.
5. **Numbers earn weight.** Output numbers — runway, FI progress, total expenses — are the reason the user is here. Give them visual priority through size and weight, not color or decoration.

## Accessibility & Inclusion

Practical minimum: visible focus rings, keyboard-navigable forms, sufficient color contrast on key text. Respect `prefers-reduced-motion` for all transitions. No formal WCAG audit at this stage.
