import { createUploadProxyHandler } from "@utils/api/uploadHandler"
import { getAgentUrl } from "@utils/api/bcConfig"
import {
  MAX_SCREENSHOT_BYTES,
  SCREENSHOT_TOO_LARGE,
} from "@lib/agent/screenshotLimit"

/**
 * Sends a brokerage screenshot to svc-agent, which reads it into a proposal
 * and records nothing. Every call is a paid vision-model call.
 */
export default createUploadProxyHandler({
  url: getAgentUrl("/agent/screenshot"),
  maxFileBytes: MAX_SCREENSHOT_BYTES,
  tooLargeMessage: SCREENSHOT_TOO_LARGE,
})

// The multipart body is streamed to svc-agent as it arrives, not parsed here.
export const config = {
  api: {
    bodyParser: false,
  },
}
