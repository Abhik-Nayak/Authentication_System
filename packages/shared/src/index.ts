// The package's public API. This is a package entry point, not the barrel-file maze PLAN.md
// section 0 forbids — it re-exports seven small modules from one directory, and services import
// from '@secure-notes/shared' rather than reaching into dist/ paths.
//
// Nothing else belongs in this package. Not business logic, not Prisma clients.

export { AppError, errorHandler } from './errors';
export { asyncHandler } from './async';
export { validate } from './validate';
export type { ValidationSource } from './validate';
export { requireUser, requireRole } from './requireUser';
export { logger, requestLogger } from './logger';
export { parsePagination, paginated } from './pagination';
export type {
  AuthUser,
  ErrorBody,
  FieldError,
  Paginated,
  PaginationMeta,
  PaginationParams,
  Role,
} from './types';
