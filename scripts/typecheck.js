#!/usr/bin/env node
// @ts-check

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

const path = require("path")
const { spawnSync } = require("child_process")

// "path(line,col): error TSnnnn: message", or a global "error TSnnnn: message".
const ERROR_LINE = /^(?:(.*?)\(\d+,\d+\): )?error TS\d+:/
const THIRD_PARTY = /(^|[\\/])node_modules[\\/]/

/**
 * The diagnostics tsc printed, split into ours and third-party ones. A
 * located error is third-party when its file is under node_modules; a global
 * one when its message names a node_modules path.
 *
 * @param {string | null | undefined} output tsc output with `--pretty false`
 * @returns {{ own: string[], thirdParty: string[] }}
 */
function classify(output) {
  /** @type {string[]} */
  const own = []
  /** @type {string[]} */
  const thirdParty = []
  for (const line of (output || "").split("\n")) {
    const match = ERROR_LINE.exec(line)
    if (match === null) continue
    const location = match[1]
    const external = location
      ? THIRD_PARTY.test(location)
      : THIRD_PARTY.test(line)
    ;(external ? thirdParty : own).push(line)
  }
  return { own, thirdParty }
}

/**
 * @param {string | null | undefined} output tsc output with `--pretty false`
 * @returns {string[]} the diagnostics that are ours to fix
 */
function ownErrors(output) {
  return classify(output).own
}

function main() {
  // The pinned compiler, never one npx might fetch, run from the repo root so
  // relative node_modules paths hold whatever the caller's directory.
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
    {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      // Lib checking prints every third-party diagnostic; the 1 MiB default
      // would cut it off with ENOBUFS and hide what failed.
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (tsc.error) {
    console.error(tsc.error.message)
    process.exit(1)
  }
  const output = `${tsc.stdout || ""}${tsc.stderr || ""}`
  const { own, thirdParty } = classify(output)
  if (own.length > 0) {
    console.error(own.join("\n"))
    console.error(`\n${own.length} type error(s) in project files`)
    process.exit(1)
  }
  // tsc failed and printed nothing we can attribute to node_modules (bad
  // config, crash, signal): never let that pass.
  if (tsc.signal || (tsc.status !== 0 && thirdParty.length === 0)) {
    console.error(output.trim() || `tsc exited with code ${tsc.status}`)
    process.exit(tsc.status || 1)
  }
}

if (require.main === module) main()

module.exports = { ownErrors, classify }
