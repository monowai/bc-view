import {
  SIDEBAR_COLLAPSED_KEY,
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from "../chatSidebar"

describe("chat sidebar collapsed preference", () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => jest.restoreAllMocks())

  it("is unset until the viewer chooses", () => {
    expect(loadSidebarCollapsed()).toBeNull()
  })

  it("round-trips the viewer's choice", () => {
    saveSidebarCollapsed(true)
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true")
    expect(loadSidebarCollapsed()).toBe(true)

    saveSidebarCollapsed(false)
    expect(loadSidebarCollapsed()).toBe(false)
  })

  it("ignores a value it did not write", () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "maybe")
    expect(loadSidebarCollapsed()).toBeNull()
  })

  it("survives storage that throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota")
    })
    expect(loadSidebarCollapsed()).toBeNull()
    expect(() => saveSidebarCollapsed(true)).not.toThrow()
  })
})
