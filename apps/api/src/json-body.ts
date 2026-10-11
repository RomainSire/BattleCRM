import { validator } from 'hono/validator';
import type { z } from 'zod';

/** The JSON body of a request, checked against its schema; anything else answers 400 `invalid`. */
export function jsonBody<Schema extends z.ZodType>(schema: Schema) {
  return validator('json', (value, c) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : c.json({ error: 'invalid' as const }, 400);
  });
}
