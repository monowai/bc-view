import { inputClass } from "./trnFormStyles"

describe("trnFormStyles", () => {
  // No forms plugin: a border colour alone draws no border, and the fields
  // vanish into the white dialog.
  it("gives every field a visible border and inner padding", () => {
    const classes = inputClass.split(" ")
    expect(classes).toContain("border")
    expect(classes).toContain("px-3")
  })
})
