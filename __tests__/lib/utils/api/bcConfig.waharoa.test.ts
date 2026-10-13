import { getWaharoaPublicUrl, getWaharoaUrl } from "@utils/api/bcConfig"

describe("waharoa config getters", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it.each(["", "   "])("treats %j as not configured", (value) => {
    process.env.BC_WAHAROA = value
    process.env.BC_WAHAROA_PUBLIC = value
    expect(getWaharoaUrl()).toBeUndefined()
    expect(getWaharoaPublicUrl()).toBeUndefined()
  })

  it("trims surrounding whitespace from configured values", () => {
    process.env.BC_WAHAROA = " http://waharoa:4000 "
    process.env.BC_WAHAROA_PUBLIC = " https://waharoa.monowai.com "
    expect(getWaharoaUrl()).toBe("http://waharoa:4000")
    expect(getWaharoaPublicUrl()).toBe("https://waharoa.monowai.com")
  })
})
