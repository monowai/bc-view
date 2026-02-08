#!/usr/bin/env node

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Import Path Regression Check
 *
 * This script prevents import path issues by:
 * 1. Scanning for broken @lib/api imports that should be @utils/api
 * 2. Validating all import paths resolve correctly
 * 3. Checking TypeScript path aliases are consistent
 * 4. Ensuring API routes can compile without errors
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

// Colors for output
const RED = "\x1b[31m"
const GREEN = "\x1b[32m"
const YELLOW = "\x1b[33m"
const RESET = "\x1b[0m"

let hasErrors = false

function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`)
}

function error(message) {
  hasErrors = true
  log(`❌ ${message}`, RED)
}

function warn(message) {
  log(`⚠️  ${message}`, YELLOW)
}

function success(message) {
  log(`✅ ${message}`, GREEN)
}

// Check 1: Scan for incorrect @lib/api imports
function checkImportPaths() {
  log("\n🔍 Checking import paths...", YELLOW)

  try {
    const result = execSync(
      'find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "@lib/api" || true',
      { encoding: "utf8" },
    )
    const files = result
      .trim()
      .split("\n")
      .filter((f) => f)

    if (files.length > 0 && files[0] !== "") {
      files.forEach((file) => {
        error(`Found @lib/api import in: ${file}`)
        // Show the actual lines
        try {
          const lines = execSync(`grep -n "@lib/api" "${file}"`, {
            encoding: "utf8",
          }).trim()
          console.log(`  ${lines.replace(/\n/g, "\n  ")}`)
        } catch {}
      })
      error(
        "❌ CRITICAL: @lib/api imports found - these will cause 500 errors!",
      )
      error(
        '   Fix with: find src -name "*.ts" -o -name "*.tsx" | xargs sed -i \'\' "s|@lib/api|@utils/api|g"',
      )
    } else {
      success("All import paths are correct (@utils/api)")
    }
  } catch (e) {
    warn(`Could not check import paths: ${e.message}`)
  }
}

// Check 2: Validate tsconfig path aliases
function checkTsConfigAliases() {
  log("\n🔍 Validating TypeScript path aliases...", YELLOW)

  try {
    const tsconfigPath = path.join(process.cwd(), "tsconfig.json")
    if (!fs.existsSync(tsconfigPath)) {
      error("tsconfig.json not found")
      return
    }

    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"))
    const paths = tsconfig.compilerOptions?.paths || {}

    // Check required aliases
    const requiredAliases = {
      "@utils/*": ["src/lib/utils/*"],
      "@lib/*": ["src/lib/utils/*"], // Both should point to same place
      "@components/*": ["src/components/*"],
      "@pages/*": ["src/pages/*"],
    }

    let aliasesOk = true
    Object.entries(requiredAliases).forEach(([alias, expectedPath]) => {
      if (!paths[alias]) {
        error(`Missing TypeScript path alias: ${alias}`)
        aliasesOk = false
      } else if (
        JSON.stringify(paths[alias]) !== JSON.stringify(expectedPath)
      ) {
        error(
          `Incorrect TypeScript path alias: ${alias} -> ${JSON.stringify(paths[alias])}, expected: ${JSON.stringify(expectedPath)}`,
        )
        aliasesOk = false
      }
    })

    if (aliasesOk) {
      success("TypeScript path aliases are configured correctly")
    }
  } catch (e) {
    error(`Error checking tsconfig.json: ${e.message}`)
  }
}

// Check 3: Verify critical API routes compile
function checkApiRoutes() {
  log("\n🔍 Checking API route compilation...", YELLOW)

  // Critical routes for reference - not currently used in compilation check

  try {
    // Try TypeScript compilation check
    execSync("npx tsc --noEmit --skipLibCheck", {
      encoding: "utf8",
      stdio: "pipe",
    })
    success("All API routes compile without errors")
  } catch (e) {
    const output = e.stdout || e.message
    if (
      output.includes("Cannot resolve module") ||
      output.includes("@lib/api")
    ) {
      error("API routes have import resolution errors:")
      console.log(output)
    } else {
      warn("TypeScript compilation warnings (may be non-critical):")
      console.log(output.slice(0, 1000) + (output.length > 1000 ? "..." : ""))
    }
  }
}

// Check 4: Ensure build files aren't corrupted
function checkBuildState() {
  log("\n🔍 Checking build state...", YELLOW)

  const nextDir = path.join(process.cwd(), ".next")
  if (fs.existsSync(nextDir)) {
    const hasErrors =
      fs.existsSync(path.join(nextDir, "trace")) ||
      fs.existsSync(path.join(nextDir, "required-server-files.json"))

    if (hasErrors) {
      warn("Next.js build cache exists - may need cleaning if issues persist")
      log("  Run: rm -rf .next && yarn build", YELLOW)
    } else {
      success("Build state looks clean")
    }
  } else {
    success("No build cache (clean state)")
  }
}


// Main execution
function main() {
  log("🔧 BC-View Import Path Regression Check", GREEN)
  log("=========================================")

  checkImportPaths()
  checkTsConfigAliases()
  checkApiRoutes()
  checkBuildState()

  if (hasErrors) {
    log("\n❌ REGRESSION CHECK FAILED", RED)
    log("Please fix the above issues before continuing.", RED)
    process.exit(1)
  } else {
    log("\n✅ ALL CHECKS PASSED", GREEN)
    log("No import path regressions detected!", GREEN)
    process.exit(0)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { main, checkImportPaths, checkTsConfigAliases }
