jest.mock("simple-git")
const mockGit = {
  __esModule: true,
  default: (): { revparse: jest.Mock } => ({
    revparse: jest
      .fn()
      .mockResolvedValueOnce("mock-branch")
      .mockResolvedValueOnce("mock-commit"),
  }),
}
export default jest.fn(() => mockGit)
