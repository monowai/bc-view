import { NextApiRequest, NextApiResponse } from "next";
import handler from "../../src/pages/api/git-info";

jest.mock("simple-git", () => {
  return () => ({
    revparse: jest
      .fn()
      .mockResolvedValueOnce("mock-branch")
      .mockResolvedValueOnce("mock-commit"),
  });
});
describe("Git Info Handler", () => {
  it("should return mock git info", async () => {
    const req = {} as NextApiRequest;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as NextApiResponse;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      branch: "mock-branch",
      commit: "mock-commit",
      build: "dev",
    });
  });
});
