import { normalizeMarkdown } from "../normalizeMarkdown"

describe("normalizeMarkdown", () => {
  it("adds the CommonMark-required space after an ATX heading marker", () => {
    expect(normalizeMarkdown("##Key Context")).toBe("## Key Context")
    expect(normalizeMarkdown("###Risks\ntext")).toBe("### Risks\ntext")
  })

  it("leaves well-formed headings untouched", () => {
    expect(normalizeMarkdown("## Key Context")).toBe("## Key Context")
  })

  it("does not treat a hash inside a code fence as a heading", () => {
    const src = "```\n#notAHeading\n```"
    expect(normalizeMarkdown(src)).toBe(src)
  })

  it("does not touch hashes mid-line", () => {
    expect(normalizeMarkdown("issue #1234 filed")).toBe("issue #1234 filed")
  })

  it("ignores runs longer than six hashes (not a heading in CommonMark)", () => {
    expect(normalizeMarkdown("#######seven")).toBe("#######seven")
  })

  it("inserts a blank line before a table that follows a paragraph", () => {
    const src = "Key Context\n| Metric | Detail |\n| --- | --- |\n| A | B |"
    expect(normalizeMarkdown(src)).toBe(
      "Key Context\n\n| Metric | Detail |\n| --- | --- |\n| A | B |",
    )
  })

  it("leaves a table that already has its blank line alone", () => {
    const src = "Key Context\n\n| Metric | Detail |\n| --- | --- |\n| A | B |"
    expect(normalizeMarkdown(src)).toBe(src)
  })

  it("does not inject a blank line inside a table body", () => {
    const src = "| Metric | Detail |\n| --- | --- |\n| A | B |\n| C | D |"
    expect(normalizeMarkdown(src)).toBe(src)
  })

  it("returns empty input unchanged", () => {
    expect(normalizeMarkdown("")).toBe("")
  })
})
