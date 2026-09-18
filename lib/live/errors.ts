/**
 * lib/live/errors.ts
 *
 * A real Error subclass so failures survive `throw`/`catch`/stack traces,
 * while still carrying the machine-readable `code` the UI switches on.
 */

import type { LiveError, LiveErrorCode } from "./types";

export class LiveFailure extends Error implements LiveError {
  readonly code: LiveErrorCode;
  readonly recoverable: boolean;
  override readonly cause?: unknown;

  constructor(code: LiveErrorCode, message: string, options?: { recoverable?: boolean; cause?: unknown }) {
    super(message);
    this.name = "LiveFailure";
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.cause = options?.cause;
  }
}

export function toLiveError(err: unknown, fallbackCode: LiveErrorCode = "UNKNOWN"): LiveError {
  if (err instanceof LiveFailure) {
    return { code: err.code, message: err.message, recoverable: err.recoverable, cause: err.cause };
  }
  if (err && typeof err === "object" && "code" in err && "message" in err) {
    const e = err as LiveError;
    return { code: e.code, message: e.message, recoverable: e.recoverable ?? true, cause: e.cause };
  }
  if (err instanceof Error) {
    return { code: fallbackCode, message: err.message, recoverable: true, cause: err };
  }
  return { code: fallbackCode, message: String(err), recoverable: true, cause: err };
}
