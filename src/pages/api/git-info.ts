import simpleGit from "simple-git"
import { NextApiRequest, NextApiResponse } from "next"

const git = simpleGit()

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const branch =
      process.env.GIT_BRANCH || (await git.revparse(["--abbrev-ref", "HEAD"]))
    const commit =
      process.env.GIT_COMMIT || (await git.revparse(["--short", "HEAD"]))
    const build = process.env.BUILD_ID || "dev"

    // No-store so stale-client detection always sees the running container's build.
    res.setHeader("Cache-Control", "no-store, must-revalidate")
    res.status(200).json({
      branch,
      commit,
      build,
    })
  } catch (error) {
    res.status(500).json({ error })
  }
}
