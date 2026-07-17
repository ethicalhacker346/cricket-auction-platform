// Lightweight network simulation layer. The real backend exposes REST
// endpoints under /api/tournaments (see tournament.routes.js) — this module
// mimics that contract with an in-memory + localStorage-backed store so the
// UI, hooks and pages can be wired exactly as they would against the live API.

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function delay<T>(value: T, ms = 380): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function fail(message: string, status = 400, code?: string): never {
  throw new ApiError(message, status, code);
}
