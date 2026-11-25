/**
 * @jest-environment node
 */
import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

/*
 * scripts/source-maps.sh, run against a miniature of what `next build` leaves:
 * a browser chunk under static, a server chunk under server, and the copy of
 * that server chunk `output: "standalone"` makes. The real sentry-cli does the
 * stamping, so a test that passes here passes on the image too.
 */
const SCRIPT = join(__dirname, "../../scripts/source-maps.sh")

// Turbopack names a map apart from its chunk, so the map's name is its own.
function chunk(path: string, map: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(
    path,
    `console.log(${JSON.stringify(map)});\n//# sourceMappingURL=${map}\n`,
  )
  writeFileSync(
    join(dirname(path), map),
    JSON.stringify({
      version: 3,
      sources: ["source.ts"],
      names: [],
      mappings: "AAAA",
    }),
  )
}

const debugIdOf = (path: string): string | undefined =>
  /debugId=([0-9a-f-]{36})/.exec(readFileSync(path, "utf8"))?.[1]

describe("the build's source maps", () => {
  let app: string
  let next: string

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), "source-maps-"))
    next = join(app, ".next")
    chunk(join(next, "static/chunks/client.js"), "clientmap.js.map")
    chunk(join(next, "server/chunks/ssr/page.js"), "pagemap.js.map")
    chunk(
      join(next, "standalone/.next/server/chunks/ssr/page.js"),
      "pagemap.js.map",
    )
    // As the build script calls it: a relative path from the app root.
    execFileSync(SCRIPT, [".next"], { cwd: app, stdio: "pipe" })
  })

  afterEach(() => rmSync(app, { recursive: true, force: true }))

  it("should leave no map where the server would hand it to a browser", () => {
    expect(existsSync(join(next, "static/chunks/clientmap.js.map"))).toBe(false)
    expect(existsSync(join(next, "static/chunks/client.js"))).toBe(true)
  })

  it("should keep every chunk and map in a folder of its own for the deploy to upload", () => {
    const kept = [
      "static/chunks/client.js",
      "static/chunks/clientmap.js.map",
      "server/chunks/ssr/page.js",
      "server/chunks/ssr/pagemap.js.map",
    ].filter((file) => !existsSync(join(next, "sourcemaps", file)))
    expect(kept).toEqual([])
  })

  it("should stamp the browser chunk with the debug id its kept map carries", () => {
    const served = debugIdOf(join(next, "static/chunks/client.js"))
    expect(served).toBeDefined()
    expect(
      readFileSync(
        join(next, "sourcemaps/static/chunks/clientmap.js.map"),
        "utf8",
      ),
    ).toContain(served)
  })

  it("should give the standalone server chunk the same debug id as the kept one", () => {
    const running = debugIdOf(
      join(next, "standalone/.next/server/chunks/ssr/page.js"),
    )
    expect(running).toBeDefined()
    expect(debugIdOf(join(next, "sourcemaps/server/chunks/ssr/page.js"))).toBe(
      running,
    )
  })

  it("should refuse a folder that is not a next build and leave it alone", () => {
    const other = mkdtempSync(join(tmpdir(), "not-next-"))
    try {
      mkdirSync(join(other, "sourcemaps"))
      expect(() => execFileSync(SCRIPT, [other], { stdio: "pipe" })).toThrow(
        /not a next build/,
      )
      expect(existsSync(join(other, "sourcemaps"))).toBe(true)
    } finally {
      rmSync(other, { recursive: true, force: true })
    }
  })
})
