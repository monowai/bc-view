import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@core/api/fetchHelper";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { Portfolio } from "@core/types/beancounter";
import { getDataUrl } from "@core/api/bc-config";
const baseUrl = getDataUrl("/portfolios");

export default withApiAuthRequired(async function portfoliosById(req, res) {
  try {
    const {
      method,
      query: { id },
    } = req;
    const { accessToken } = await getAccessToken(req, res);
    console.log(`${method} for portfolio ${id}`);
    switch (method?.toUpperCase()) {
      case "GET": {
        if (id === "__NEW__") {
          const defaultPortfolio = {
            data: {
              id: "",
              code: "",
              name: "",
              currency: { id: "USD", code: "USD", symbol: "$" },
              base: { id: "USD", code: "USD", symbol: "$" },
            },
          };
          res.status(200).json(defaultPortfolio);
          break;
        } else {
          const response = await fetch(
            `${baseUrl}/${id}`,
            requestInit(accessToken)
          );
          await handleResponse<Portfolio>(response, res);
          break;
        }
      }
      case "POST": {
        const response = await fetch(
          `${baseUrl}`,
          requestInit(accessToken, method)
        );
        await handleResponse<Portfolio>(response, res);
        break;
      }

      case "DELETE": {
        const response = await fetch(
          `${baseUrl}/${id}`,
          requestInit(accessToken, method)
        );
        await handleResponse<void>(response, res);
        break;
      }
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
