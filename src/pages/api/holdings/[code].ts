import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@core/api/fetchHelper";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { HoldingContract } from "@core/types/beancounter";
import { getPositionsUrl } from "@core/api/bc-config";

const baseUrl = getPositionsUrl();
export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const {
      query: { code },
    } = req;
    console.log(`Looking up holdings ${code}`);
    const response = await fetch(
      `${baseUrl}/${code}/today`,
      requestInit(accessToken)
    );
    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
