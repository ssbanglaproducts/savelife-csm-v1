/** Error codes shared by the financial service layer. */
export type ServiceErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "BELOW_MINIMUM"
  | "INVALID_STATE"
  | "UNIQUE_CONFLICT";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function invalidInput(message: string): ServiceError {
  return new ServiceError("INVALID_INPUT", message);
}

export function notFound(message: string): ServiceError {
  return new ServiceError("NOT_FOUND", message);
}
