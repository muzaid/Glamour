/** Named domain errors mapped to an RFC 7807-like `{ error: { code, message, requestId, details } }` body. */
export type ErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "PRODUCT_UNAVAILABLE"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "CURRENCY_MISMATCH"
  | "IDEMPOTENCY_REPLAY_MISMATCH"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "QUOTA_EXCEEDED"
  | "LICENSE_MISSING"
  | "PREFLIGHT_FAILED"
  | "REVIEW_LINK_INVALID"
  | "FEATURE_DISABLED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_TRANSITION: 409,
  PRODUCT_UNAVAILABLE: 409,
  OUT_OF_STOCK: 409,
  PRICE_CHANGED: 409,
  CURRENCY_MISMATCH: 400,
  IDEMPOTENCY_REPLAY_MISMATCH: 422,
  WEBHOOK_SIGNATURE_INVALID: 400,
  QUOTA_EXCEEDED: 429,
  LICENSE_MISSING: 422,
  PREFLIGHT_FAILED: 422,
  REVIEW_LINK_INVALID: 404,
  FEATURE_DISABLED: 503,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;
  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

/**
 * Not-found and forbidden for tenant resources collapse to NOT_FOUND so callers
 * cannot probe for the existence of another tenant's rows.
 */
export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);

export function toErrorBody(e: unknown, requestId: string) {
  if (isAppError(e)) {
    return { status: e.status, body: { error: { code: e.code, message: e.message, requestId, details: e.details } } };
  }
  // Never leak stack traces, table names or object keys.
  return { status: 500, body: { error: { code: "INTERNAL", message: "Unexpected error", requestId, details: {} } } };
}
