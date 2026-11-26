/**
 * Round a monetary value to cents using decimal half-up. Plain
 * `Math.round(n * 100) / 100` (and `n.toFixed(2)`) mis-round values whose
 * IEEE-754 representation lands just below the .5 boundary — e.g. 1.005 is
 * stored as 1.00499999…, so both naive forms yield 1.00. Nudging by a relative
 * epsilon before scaling restores the intended half-up result (1.005 → 1.01).
 */
export const roundMoney = (n: number): number =>
  Math.round((n + Math.sign(n) * Math.abs(n) * Number.EPSILON) * 100) / 100
