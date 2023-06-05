export function deleteTrn(trnId: string, message: string): Promise<void> | any {
  if (confirm(message))
    return fetch(`/api/trns/trades/${trnId}`, {
      method: "DELETE",
    });
}

export function deletePortfolio(
  portfolioId: string,
  message: string
): Promise<void> | any {
  if (confirm(message))
    return fetch(`/api/portfolios/${portfolioId}`, {
      method: "DELETE",
    });
}
