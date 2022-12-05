import {ApiError} from "next/dist/server/api-utils";

export class BcApiError extends ApiError{
  readonly devMessage: string
  readonly devStack: string
  readonly code: string
  constructor(error: any) {
    super(error.status || 500, error.message);
    this.devMessage = error.message
    this.devStack = error.stack
    this.code = error.code
  }
}