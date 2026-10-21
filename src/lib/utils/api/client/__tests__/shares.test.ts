import {
  acceptShare,
  grantedResourceSharesKey,
  inviteAdviser,
  resourceShareUrl,
  resourceSharesManagedKey,
  resourceSharesPendingKey,
  revokeShare,
  sharesGrantedKey,
  sharesManagedKey,
  sharesPendingKey,
} from "@utils/api/client/shares"
import {
  corporateEventsKey,
  loadCorporateEventsUrl,
  processCorporateEvent,
} from "@utils/api/client/corporateEvents"

describe("shares api keys", () => {
  it("builds the same URLs the call sites used", () => {
    expect(sharesPendingKey).toBe("/api/shares/pending")
    expect(sharesManagedKey).toBe("/api/shares/managed")
    expect(sharesGrantedKey).toBe("/api/shares/granted")
    expect(resourceSharesPendingKey).toBe("/api/resource-shares/pending")
    expect(resourceSharesManagedKey("INDEPENDENCE_PLAN")).toBe(
      "/api/resource-shares/managed/INDEPENDENCE_PLAN",
    )
    expect(grantedResourceSharesKey("REBALANCE_MODEL")).toBe(
      "/api/resource-shares/granted/REBALANCE_MODEL",
    )
    expect(resourceShareUrl("s1")).toBe("/api/resource-shares/s1")
  })
})

describe("shares api requests", () => {
  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true }) as unknown as typeof fetch
  })

  it("accepts and revokes with bare requests", async () => {
    await acceptShare("s1")
    await revokeShare("s1")
    expect(global.fetch).toHaveBeenCalledWith("/api/shares/s1/accept", {
      method: "POST",
    })
    expect(global.fetch).toHaveBeenCalledWith("/api/shares/s1", {
      method: "DELETE",
    })
  })

  it("invites an adviser as JSON", async () => {
    await inviteAdviser({ adviserEmail: "a@b.c" })
    expect(global.fetch).toHaveBeenCalledWith("/api/shares/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"adviserEmail":"a@b.c"}',
    })
  })
})

describe("corporate events api", () => {
  it("builds the same URLs the call sites used", () => {
    expect(corporateEventsKey("a1")).toBe("/api/corporate-events/a1")
    expect(corporateEventsKey("a1", "2026-01-01", "2026-02-01")).toBe(
      "/api/corporate-events/a1?fromDate=2026-01-01&toDate=2026-02-01",
    )
    expect(loadCorporateEventsUrl("a1", "2026-01-01")).toBe(
      "/api/corporate-events/load/asset/a1?asAt=2026-01-01",
    )
  })

  it("processes an event, with an optional pay date", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500 })
    global.fetch = fetchMock as unknown as typeof fetch
    const res = await processCorporateEvent("e1")
    await processCorporateEvent("e1", "2026-03-01")
    expect(res.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith("/api/corporate-events/process/e1", {
      method: "POST",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/corporate-events/process/e1?payDate=2026-03-01",
      { method: "POST" },
    )
  })
})
