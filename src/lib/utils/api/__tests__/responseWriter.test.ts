import { handleErrors } from "@utils/api/responseWriter"
import { BcApiError } from "@components/errors/bcApiError"

/** The parts of a fetch Response that handleErrors reads. */
function backend(status: number, body: unknown, statusText: string): Response {
  return {
    status,
    statusText,
    url: "http://backend/test",
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe("handleErrors", () => {
  test("keeps a backend's machine code, so the client can explain the refusal", async () => {
    const error = await handleErrors(
      backend(
        403,
        { code: "email-unverified", message: "Confirm your email address" },
        "Forbidden",
      ),
    ).catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(BcApiError)
    expect((error as BcApiError).code).toBe("email-unverified")
    expect((error as BcApiError).message).toBe("Confirm your email address")
  })

  test("falls back to the status phrase when the backend sends no code", async () => {
    const error = await handleErrors(
      backend(403, { status: 403, error: "Forbidden" }, "Forbidden"),
    ).catch((thrown: unknown) => thrown)

    expect((error as BcApiError).code).toBe("Forbidden")
  })
})
