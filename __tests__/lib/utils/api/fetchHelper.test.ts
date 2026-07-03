import { postJson, patchJson } from "@utils/api/fetchHelper"

const mockFetch = jest.fn()
global.fetch = mockFetch

afterEach(() => {
  jest.resetAllMocks()
})

function makeOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response
}

function makeErrorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: "Bad Request",
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response
}

describe("postJson", () => {
  it("sends POST with JSON content-type and serialised body", async () => {
    const payload = { foo: "bar" }
    mockFetch.mockResolvedValue(makeOkResponse({ result: 1 }))

    await postJson("/api/test", payload)

    expect(mockFetch).toHaveBeenCalledWith("/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  })

  it("returns parsed JSON on 2xx", async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ data: 42 }))

    const result = await postJson<{ data: number }>("/api/test", {})

    expect(result).toEqual({ data: 42 })
  })

  it("throws with server error message on non-ok (error field present)", async () => {
    mockFetch.mockResolvedValue(
      makeErrorResponse(400, { error: "Invalid input" }),
    )

    await expect(postJson("/api/test", {})).rejects.toThrow("Invalid input")
  })

  it("throws with url/status fallback when server body has no error field", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(500, {}))

    await expect(postJson("/api/test", {})).rejects.toThrow(
      "/api/test failed (500 Bad Request)",
    )
  })

  it("throws with url/status fallback when body is not JSON", async () => {
    const response = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: jest.fn().mockRejectedValue(new SyntaxError("not json")),
    } as unknown as Response
    mockFetch.mockResolvedValue(response)

    await expect(postJson("/api/test", {})).rejects.toThrow(
      "/api/test failed (503 Service Unavailable)",
    )
  })
})

describe("patchJson", () => {
  it("sends PATCH with JSON content-type and serialised body", async () => {
    const payload = { status: "PROPOSED" }
    mockFetch.mockResolvedValue(makeOkResponse({ updated: 1 }))

    await patchJson("/api/trns/status/abc", payload)

    expect(mockFetch).toHaveBeenCalledWith("/api/trns/status/abc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  })

  it("returns parsed JSON on 2xx", async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ updated: true }))

    const result = await patchJson<{ updated: boolean }>("/api/patch", {})

    expect(result).toEqual({ updated: true })
  })

  it("throws with server error message on non-ok", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(404, { error: "Not found" }))

    await expect(patchJson("/api/patch", {})).rejects.toThrow("Not found")
  })

  it("throws with url/status fallback when body has no error field", async () => {
    mockFetch.mockResolvedValue(makeErrorResponse(422, {}))

    await expect(patchJson("/api/patch", {})).rejects.toThrow(
      "/api/patch failed (422 Bad Request)",
    )
  })
})
