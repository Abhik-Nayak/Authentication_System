import type { Paginated, PaginationMeta, PaginationParams } from './types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toInt(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : fallback;
  if (typeof value !== 'string') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Reads `page` and `limit` off a query object and clamps them into range.
 *
 * Clamped rather than rejected: `?page=-3` is a stale link, not an attack, and a 422 on a list
 * endpoint is a worse experience than page 1. MAX_LIMIT is the part that matters — without it
 * `?limit=1000000` is a one-request denial of service against the database.
 */
export function parsePagination(query: unknown): PaginationParams {
  const q = (query ?? {}) as Record<string, unknown>;
  const page = clamp(toInt(q.page, 1), 1, Number.MAX_SAFE_INTEGER);
  const limit = clamp(toInt(q.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

/** Wraps a page of rows in the response envelope every list endpoint returns. */
export function paginated<T>(data: T[], total: number, params: PaginationParams): Paginated<T> {
  const meta: PaginationMeta = {
    page: params.page,
    limit: params.limit,
    total,
    // 0 rows means 0 pages, not 1 — a client rendering "Page 1 of 1" over an empty list is wrong.
    totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
  };
  return { data, meta };
}
