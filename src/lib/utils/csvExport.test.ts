import { escapeCSV, parseCsvLine } from "./csvExport"

describe("escapeCSV", () => {
  it("returns plain values unchanged", () => {
    expect(escapeCSV("VOO")).toBe("VOO")
  })

  it("quotes and escapes values containing a comma", () => {
    expect(escapeCSV("Vanguard, Inc.")).toBe('"Vanguard, Inc."')
  })

  it("quotes and doubles embedded quotes", () => {
    expect(escapeCSV('Say "hi"')).toBe('"Say ""hi"""')
  })

  it("quotes values containing a newline", () => {
    expect(escapeCSV("line1\nline2")).toBe('"line1\nline2"')
  })

  it("returns an empty string for null/undefined", () => {
    expect(escapeCSV(null as unknown as string)).toBe("")
  })
})

describe("parseCsvLine", () => {
  it("splits a simple comma-separated line", () => {
    expect(parseCsvLine("US:VOO,50,123.45")).toEqual(["US:VOO", "50", "123.45"])
  })

  it("splits on tabs as well as commas", () => {
    expect(parseCsvLine("US:VOO\t50\t123.45")).toEqual([
      "US:VOO",
      "50",
      "123.45",
    ])
  })

  it("keeps commas inside quoted fields together", () => {
    expect(parseCsvLine('US:VOO,50,"Vanguard, Inc."')).toEqual([
      "US:VOO",
      "50",
      "Vanguard, Inc.",
    ])
  })

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsvLine('US:VOO,50,"Say ""hi"""')).toEqual([
      "US:VOO",
      "50",
      'Say "hi"',
    ])
  })

  it("trims whitespace around unquoted fields", () => {
    expect(parseCsvLine(" US:VOO , 50 ")).toEqual(["US:VOO", "50"])
  })

  it("returns a single empty-string field for an empty line", () => {
    expect(parseCsvLine("")).toEqual([""])
  })
})
