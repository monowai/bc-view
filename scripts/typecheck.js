#!/usr/bin/env node

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Type check including our own declaration files.
 *
 * tsconfig sets `skipLibCheck: true`, which skips every `.d.ts` — ours in
 * `types/` as well as node_modules'. An undefined name in a `.d.ts` then
 * silently becomes `any` for every consumer. This runs tsc with lib checking
 * on and fails on any error outside node_modules, whose own declaration
 * errors (react-switch, immer) are not ours to fix.
 */

const { spawnSync } = require("child_process")

// "path(line,col): error TSnnnn: message", or a global "error TSnnnn: message".
const ERROR_LINE = /^(?:(.*?)\(\d+,\d+\): )?error TS\d+:/

function ownErrors(output) {
  return output.split("\n").filter((line) => {
    const match = ERROR_LINE.exec(line)
    return match !== null && !(match[1] || "").startsWith("node_modules/")
  })
}

function main() {
  // The pinned compiler, never one npx might fetch.
  const tsc = spawnSync(
    process.execPath,
    [
      require.resolve("typescript/bin/tsc"),
      "--noEmit",
      "--skipLibCheck",
      "false",
      "--pretty",
      "false",
    ],
    { encoding: "utf8" },
  )
  if (tsc.error) {
    console.error(tsc.error.message)
    process.exit(1)
  }
  const output = `${tsc.stdout}${tsc.stderr}`
  const errors = ownErrors(output)
  if (errors.length > 0) {
    console.error(errors.join("\n"))
    console.error(`\n${errors.length} type error(s) in project files`)
    process.exit(1)
  }
  // tsc failed without a diagnostic we can read (bad config, crash, signal):
  // never let that pass. Third-party declaration errors alone also exit
  // non-zero, so only fail when nothing but those was reported.
  const thirdPartyOnly = output
    .split("\n")
    .some((line) => line.startsWith("node_modules/"))
  if (tsc.signal || (tsc.status !== 0 && !thirdPartyOnly)) {
    console.error(output.trim() || `tsc exited with code ${tsc.status}`)
    process.exit(tsc.status || 1)
  }
}

if (require.main === module) main()

module.exports = { ownErrors }
