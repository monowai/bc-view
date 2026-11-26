/** The flash for a row a link jumped to (styles/globals.css). */
const FLASH = "asset-target"

/** Flash a jumped-to element, replaying the flash if it is already showing. */
export function flashTarget(el: HTMLElement): void {
  el.classList.remove(FLASH)
  // Reflow so the animation restarts when the same element is jumped to again.
  void el.offsetWidth
  el.classList.add(FLASH)
}
