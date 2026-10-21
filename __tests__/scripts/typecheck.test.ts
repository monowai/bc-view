import { ownErrors } from "../../scripts/typecheck"

describe("ownErrors", () => {
  it("keeps errors in our declaration files and source", () => {
    const output = [
      "types/beancounter/holdings.d.ts(74,12): error TS2304: Cannot find name 'ValuationCcy'.",
      "src/lib/utils/currency.ts(3,1): error TS2322: Type 'string' is not assignable to type 'number'.",
    ].join("\n")

    expect(ownErrors(output)).toEqual([
      "types/beancounter/holdings.d.ts(74,12): error TS2304: Cannot find name 'ValuationCcy'.",
      "src/lib/utils/currency.ts(3,1): error TS2322: Type 'string' is not assignable to type 'number'.",
    ])
  })

  it("ignores errors inside third-party declarations", () => {
    const output = [
      "node_modules/react-switch/index.d.ts(9,3): error TS2503: Cannot find namespace 'JSX'.",
      "node_modules/immer/dist/immer.d.ts(1,1): error TS2403: Subsequent variable declarations must have the same type.",
    ].join("\n")

    expect(ownErrors(output)).toEqual([])
  })

  it("ignores continuation lines of a multi-line message", () => {
    const output = [
      "types/app.d.ts(10,3): error TS7008: Member 'value' implicitly has an 'any' type.",
      "  Type 'X' is not assignable to type 'Y'.",
    ].join("\n")

    expect(ownErrors(output)).toEqual([
      "types/app.d.ts(10,3): error TS7008: Member 'value' implicitly has an 'any' type.",
    ])
  })

  it("keeps a global error that names no file", () => {
    const output = "error TS5023: Unknown compiler option 'foo'."

    expect(ownErrors(output)).toEqual([
      "error TS5023: Unknown compiler option 'foo'.",
    ])
  })

  it("reads a path that contains spaces", () => {
    const output =
      "node_modules/some pkg/index.d.ts(1,1): error TS2503: Cannot find namespace 'JSX'."

    expect(ownErrors(output)).toEqual([])
  })

  it("treats a global error naming a node_modules file as third-party", () => {
    const output =
      "error TS6053: File '/repo/node_modules/some-pkg/index.d.ts' not found."

    expect(ownErrors(output)).toEqual([])
  })

  it("reads a Windows-style node_modules path as third-party", () => {
    const output =
      "C:\\repo\\node_modules\\pkg\\index.d.ts(1,1): error TS2503: Cannot find namespace 'JSX'."

    expect(ownErrors(output)).toEqual([])
  })

  it("returns nothing for missing output", () => {
    expect(ownErrors(null)).toEqual([])
  })
})
