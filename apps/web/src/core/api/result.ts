import { parseApiError } from "./api-errors";

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  request?: Request;
  response?: Response;
}

export function apiVoid(result: ApiResult<unknown>): void {
  if (result.error !== undefined) {
    if (result.request?.signal.aborted) throw result.request.signal.reason;
    if (
      result.error &&
      typeof result.error === "object" &&
      "name" in result.error &&
      result.error.name === "AbortError"
    ) {
      throw result.error;
    }
    throw parseApiError(result.error, result.response?.status);
  }
  if (!result.response) throw new Error("Server nevrátil odpověď.");
  if (!result.response.ok) throw parseApiError(undefined, result.response.status);
}

export function apiData<T>(result: ApiResult<T>): NonNullable<T> {
  apiVoid(result);
  if (
    result.data === undefined ||
    result.data === null ||
    result.response?.status === 204 ||
    result.response?.status === 205 ||
    result.response?.headers.get("Content-Length") === "0"
  ) {
    throw new Error("Server nevrátil očekávaná data.");
  }
  return result.data;
}
