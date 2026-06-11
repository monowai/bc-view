import { extractAuth0Detail } from "./auth0Errors"

describe("extractAuth0Detail", () => {
  it("returns undefined for nullish or non-object errors", () => {
    expect(extractAuth0Detail(null)).toBeUndefined()
    expect(extractAuth0Detail(undefined)).toBeUndefined()
    expect(extractAuth0Detail("string")).toBeUndefined()
    expect(extractAuth0Detail(42)).toBeUndefined()
  })

  it("returns undefined when no diagnostic fields are present", () => {
    expect(extractAuth0Detail({})).toBeUndefined()
  })

  it("captures default Error.name when no other detail is available", () => {
    expect(extractAuth0Detail(new Error())).toEqual({ errorName: "Error" })
  })

  it("captures top-level name and code", () => {
    const err = Object.assign(new Error("wrapper"), {
      name: "AuthorizationError",
      code: "authorization_error",
    })
    expect(extractAuth0Detail(err)).toEqual({
      errorName: "AuthorizationError",
      errorCode: "authorization_error",
    })
  })

  it("captures cause name, code, and message (OAuth2Error inside AuthorizationError)", () => {
    const cause = Object.assign(new Error("Action threw post-login"), {
      name: "OAuth2Error",
      code: "access_denied",
    })
    const err = Object.assign(
      new Error("An error occurred during the authorization flow."),
      {
        name: "AuthorizationError",
        cause,
      },
    )
    expect(extractAuth0Detail(err)).toEqual({
      errorName: "AuthorizationError",
      causeName: "OAuth2Error",
      causeCode: "access_denied",
      causeMessage: "Action threw post-login",
    })
  })

  it("ignores empty string fields", () => {
    expect(
      extractAuth0Detail({ name: "", code: "", cause: { message: "" } }),
    ).toBeUndefined()
  })
})
