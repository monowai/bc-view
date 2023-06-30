import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@core/api/fetchHelper";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { Portfolio, PortfolioResponse } from "@core/types/beancounter";
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
    const byId = `${baseUrl}/${id}`;
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
          const response = await fetch(byId, requestInit(accessToken));
          await handleResponse<Portfolio>(response, res);
          break;
        }
      }
      case "PATCH": {
        const response = await fetch(byId, {
          method,
          body: JSON.stringify(req.body),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        await handleResponse<Portfolio>(response, res);
        break;
      }

      case "POST": {
        const response = await fetch(`${baseUrl}`, {
          method,
          body: JSON.stringify(req.body),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });
        await handleResponse<PortfolioResponse>(response, res);
        break;
      }

      case "DELETE": {
        const response = await fetch(byId, requestInit(accessToken, method));
        await handleResponse<void>(response, res);
        break;
      }
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
