import {
  ApiError,
  jsonInit,
  readServerMessage,
} from "@utils/api/client/request"

function response(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () =>
      body === undefined
        ? Promise.reject(new SyntaxError("Unexpected end of JSON input"))
        : Promise.resolve(body),
  } as unknown as Response
}

describe("readServerMessage", () => {
  it("prefers the BFF's message, then error", async () => {
    await expect(
      readServerMessage(response(400, { message: "m", error: "e" })),
    ).resolves.toBe("m")
    await expect(
      readServerMessage(response(400, { error: "e" })),
    ).resolves.toBe("e")
  })

  it("is undefined when the body says nothing or is not JSON", async () => {
    await expect(readServerMessage(response(500, {}))).resolves.toBeUndefined()
    await expect(
      readServerMessage(response(500, undefined)),
    ).resolves.toBeUndefined()
  })
})

describe("jsonInit", () => {
  it("serialises the body with a JSON content type", () => {
    expect(jsonInit("PATCH", { a: 1 })).toEqual({
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    })
  })
})

describe("ApiError", () => {
  it("keeps the HTTP status", () => {
    const err = new ApiError(409, "conflict")
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(409)
    expect(err.message).toBe("conflict")
  })
})
