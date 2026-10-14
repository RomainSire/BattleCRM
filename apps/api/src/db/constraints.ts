/** Whether the database refused a write for this unique constraint. */
export const violates = (error: unknown, constraint: string): boolean =>
  error instanceof Error &&
  ((typeof error.cause === 'object' &&
    error.cause !== null &&
    'code' in error.cause &&
    error.cause.code === '23505' &&
    'constraint' in error.cause &&
    error.cause.constraint === constraint) ||
    violates(error.cause, constraint));
