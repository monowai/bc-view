export function requestInit(accessToken: string | undefined, method: string = "GET"): RequestInit {
  return {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

export function simpleFetcher(key: string): any {
  return async () => {
    const res = await fetch(key);
    if (!res.ok) {
      throw await res.json();
    }
    return res.json();
  };
}

export const ccyKey = "/api/currencies";

export const portfoliosKey = "/api/portfolios";
export const assetKey = (assetId: string): string => `/api/assets/${assetId}`;
export const tradeKey = (portfolioId: string, assetId: string): string =>
  `/api/trns/trades/${portfolioId}/${assetId}`;
export const eventKey = (portfolioId: string, assetId: string): string =>
  `/api/trns/events/${portfolioId}/${assetId}`;

export const holdingKey = (portfolioCode: string): string =>
  `/api/holdings/${portfolioCode}`;

export const portfolioKey = (portfolioId: string): string =>
  `${portfoliosKey}/${portfolioId}`;
