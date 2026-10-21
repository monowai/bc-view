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
const ERROR_LINE = /^(?:(\S+)\(\d+,\d+\): )?error TS\d+:/

function ownErrors(output) {
  return output.split("\n").filter((line) => {
    const match = ERROR_LINE.exec(line)
    return match !== null && !(match[1] || "").startsWith("node_modules/")
  })
}

function main() {
  const tsc = spawnSync(
    "npx",
    ["tsc", "--noEmit", "--skipLibCheck", "false", "--pretty", "false"],
    { encoding: "utf8" },
  )
  if (tsc.error) {
    console.error(tsc.error.message)
    process.exit(1)
  }
  const errors = ownErrors(`${tsc.stdout}${tsc.stderr}`)
  if (errors.length > 0) {
    console.error(errors.join("\n"))
    console.error(`\n${errors.length} type error(s) in types/ or src/`)
    process.exit(1)
  }
}

if (require.main === module) main()

module.exports = { ownErrors }
