import { ApiError } from "next/dist/server/api-utils";

export class BcApiError extends ApiError {
  readonly devMessage: string;
  readonly devStack: string | undefined;
  readonly path: string | undefined;
  readonly code: string;
  constructor(
    status: number,
    message: string,
    code: string,
    path: string | undefined,
    stack: string | undefined = undefined
  ) {
    super(status || 500, message);
    this.devMessage = message;
    this.code = code;
    this.path = path;
    this.devStack = stack;
  }
}
