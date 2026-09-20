import { readErrorMessage } from "@utils/api/readErrorMessage"

const response = (
  status: number,
  body?: string,
  statusText?: string,
): Response =>
  ({
    ok: false,
    status,
    statusText,
    ...(body === undefined ? {} : { text: () => Promise.resolve(body) }),
  }) as unknown as Response

describe("readErrorMessage", () => {
  it("prefers the BFF's `message`", async () => {
    await expect(
      readErrorMessage(
        response(
          400,
          JSON.stringify({
            message:
              "Set a target independence age or year of birth before generating phases",
            error: "Bad Request",
            code: "BUSINESS",
          }),
        ),
        "Failed",
      ),
    ).resolves.toBe(
      "Set a target independence age or year of birth before generating phases",
    )
  })

  it("falls back to `error`", async () => {
    await expect(
      readErrorMessage(
        response(409, JSON.stringify({ error: "composite exists" })),
        "Failed",
      ),
    ).resolves.toBe("composite exists")
  })

  it("falls back to the raw body when it is not JSON", async () => {
    await expect(
      readErrorMessage(response(500, "upstream unavailable"), "Failed"),
    ).resolves.toBe("upstream unavailable")
  })

  it("falls back to the caller's sentence plus the status", async () => {
    await expect(
      readErrorMessage(response(503, ""), "Failed to save"),
    ).resolves.toBe("Failed to save: 503")
    await expect(
      readErrorMessage(response(503, "", "Service Unavailable"), "Failed"),
    ).resolves.toBe("Failed: 503 Service Unavailable")
  })

  it("treats an unreadable body as one that says nothing", async () => {
    await expect(
      readErrorMessage(response(502), "Failed to save"),
    ).resolves.toBe("Failed to save: 502")
  })
})
