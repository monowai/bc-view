import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@utils/api/fetchHelper";
import handleResponse from "@utils/api/response-writer";
import { HoldingContract } from "@components/types/beancounter";
import { getPositionsUrl } from "@utils/api/bc-config";

const baseUrl = getPositionsUrl();

export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const {
      query: { code },
    } = req;

    const response = await fetch(
      `${baseUrl}/${code}/today`,
      requestInit(accessToken),
    );

    if (!response.ok) {
      console.error(`Failed to fetch holdings: ${response.statusText}`); // Log the error for debugging
      res.status(500).json({
        status: "error",
        message: `Failed to fetch holdings: ${response.statusText}`,
      });
      return;
    }

    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    console.error(error); // Log the error for debugging
    res.status(500).json({
      status: "error",
      message:
        error.message ||
        "An unexpected error occurred while obtaining the holdings.",
    });
  }
});
