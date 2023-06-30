export function requestInit(
  accessToken: string | undefined,
  method: string = "GET"
): RequestInit {
  return {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  };
}

export function simpleFetcher(requestInfo: RequestInfo): any {
  return async () => {
    const res = await fetch(requestInfo);
    if (!res.ok) {
      throw await res.json();
    }
    return res.json();
  };
}

export const ccyKey = "/api/currencies";

export const portfoliosKey = "/api/portfolios";

export const trnsKey = "/api/trns";
export const assetKey = (assetId: string): string => `/api/assets/${assetId}`;
export const tradeKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/trades/${portfolioId}/${assetId}`;
export const eventKey = (portfolioId: string, assetId: string): string =>
  `${trnsKey}/events/${portfolioId}/${assetId}`;

export const holdingKey = (portfolioCode: string): string =>
  `/api/holdings/${portfolioCode}`;

export const portfolioKey = (portfolioId: string): string =>
  `${portfoliosKey}/${portfolioId}`;
