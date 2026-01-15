export class PaynetSDKError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** API request failure with HTTP response details */
export class PaynetApiError extends PaynetSDKError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly body?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/** Authentication failure */
export class PaynetAuthenticationError extends PaynetApiError {}

/** Network request failure (connection errors, timeouts) */
export class PaynetNetworkError extends PaynetSDKError {}

/** Validation failure (missing/invalid data) */
export class PaynetValidationError extends PaynetSDKError {}
