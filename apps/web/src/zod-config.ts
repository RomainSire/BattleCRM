import { z } from 'zod';

// Zod compiles its object parsers with `new Function`, which the CSP forbids (`script-src 'self'`).
// It must run before the first schema is built, Zod probing for eval as soon as one is: hence its own
// module, imported first by `main.tsx`, since the modules a file imports are evaluated before its body.
z.config({ jitless: true });
