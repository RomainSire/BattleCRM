import { z } from 'zod';

const uuid = z.uuid();

/**
 * The row a route names by its `:id`: `null` for an id that is none, which answers like an unknown
 * one, another User's included.
 */
export function idOf(param: string | undefined): string | null {
  const id = uuid.safeParse(param);
  return id.success ? id.data : null;
}
