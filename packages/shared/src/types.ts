export type Role = 'USER' | 'ADMIN';

/** The identity the gateway injected via headers. Never decoded from a JWT downstream. */
export interface AuthUser {
  id: string;
  role: Role;
}

export interface FieldError {
  path: string;
  message: string;
}

/** The one error shape every service returns. See docs/api-contracts.md. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: FieldError[];
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  /** Rows to skip — hands straight to Prisma's `skip`. */
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express's own type is a namespace; augmenting it requires matching that shape.
  namespace Express {
    interface Request {
      /** Set by requireUser. Absent until that middleware has run. */
      user?: AuthUser;
      /** Set by validate(). The parsed, coerced, trusted input — req.body stays raw. */
      valid?: unknown;
    }
  }
}
