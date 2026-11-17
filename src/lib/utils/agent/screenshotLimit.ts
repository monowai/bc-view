/** The largest screenshot svc-agent reads: its `ScreenshotController.MAX_BYTES`. */
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

/** What the user is told when a screenshot is larger than that. */
export const SCREENSHOT_TOO_LARGE =
  "That image is larger than 8 MB. Crop it or save a smaller copy, then try again."
