// noinspection JSUnusedGlobalSymbols

import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { HoldingContract } from "@/types/beancounter";
import { getPositionsUrl } from "@/core/api/bc-config";
import {BcApiError} from "@/core/errors/bcApiError";

const baseUrl = getPositionsUrl("");
export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const {
      query: { code },
    } = req;
    console.log(`Looking up holdings ${code}`);
    const response = await fetch(`${baseUrl}/${code}/today`, requestInit(accessToken));
    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    const apiError = new BcApiError(error);
    console.error(apiError);
    res.status(apiError.statusCode).json(apiError);
  }
});
