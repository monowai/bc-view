import handler from "@pages/api/git-info"
import { NextApiRequest, NextApiResponse } from "next"

const mockRevparse = jest.fn()

// simple-git v4 exposes only the named `simpleGit` export (no default).
// The handler calls simpleGit() at import time, so defer the mock lookup.
jest.mock("simple-git", () => ({
  simpleGit: jest.fn(() => ({
    revparse: (...args: unknown[]) => mockRevparse(...args),
  })),
}))

interface Res {
  status: jest.Mock
  setHeader: jest.Mock
  json: jest.Mock
}

function makeRes(): Res {
  return {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

async function call(res: Res): Promise<void> {
  await handler(
    {} as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  )
}

describe("/api/git-info", () => {
  const env = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...env }
    delete process.env.GIT_BRANCH
    delete process.env.GIT_COMMIT
    delete process.env.BUILD_ID
  })

  afterAll(() => {
    process.env = env
  })

  it("reads branch and commit from git when env is unset", async () => {
    mockRevparse
      .mockResolvedValueOnce("feature/x")
      .mockResolvedValueOnce("abc1234")
    const res = makeRes()

    await call(res)

    expect(mockRevparse).toHaveBeenNthCalledWith(1, ["--abbrev-ref", "HEAD"])
    expect(mockRevparse).toHaveBeenNthCalledWith(2, ["--short", "HEAD"])
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, must-revalidate",
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      branch: "feature/x",
      commit: "abc1234",
      build: "dev",
    })
  })

  it("prefers build-time env over git", async () => {
    process.env.GIT_BRANCH = "main"
    process.env.GIT_COMMIT = "deadbee"
    process.env.BUILD_ID = "42"
    const res = makeRes()

    await call(res)

    expect(mockRevparse).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      branch: "main",
      commit: "deadbee",
      build: "42",
    })
  })

  it("returns 500 when git fails", async () => {
    mockRevparse.mockRejectedValueOnce(new Error("not a git repository"))
    const res = makeRes()

    await call(res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Error) })
  })
})
