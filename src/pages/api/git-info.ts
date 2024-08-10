import simpleGit from "simple-git";
import { NextApiRequest, NextApiResponse } from "next";

const git = simpleGit();

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    console.log("Git Info Handler");
    const branch =
      process.env.GIT_BRANCH || (await git.revparse(["--abbrev-ref", "HEAD"]));
    const commit =
      process.env.GIT_COMMIT || (await git.revparse(["--short", "HEAD"]));
    const build = process.env.BUILD_ID || "dev";

    res.status(200).json({
      branch,
      commit,
      build,
    });
  } catch (error) {
    res.status(500).json({ error });
  }
}
