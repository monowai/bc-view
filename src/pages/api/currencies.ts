import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Currency } from "@components/types/beancounter";
import handleResponse, { fetchError } from "@utils/api/response-writer";
import { getDataUrl } from "@utils/api/bc-config";
import { NextApiRequest, NextApiResponse } from "next";

const baseUrl = getDataUrl("/currencies");

export default withApiAuthRequired(async function currencies(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  console.log(`requesting currencies from ${baseUrl}`);
  try {
    const { accessToken } = await getAccessToken(req, res);

    const response = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await handleResponse<Currency[]>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
