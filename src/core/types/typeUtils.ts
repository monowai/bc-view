export function isDone(response: any): boolean {
  return !response.isLoading;
}
