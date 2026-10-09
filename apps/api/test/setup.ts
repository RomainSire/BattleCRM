import { pino } from 'pino';
import { afterAll, inject } from 'vitest';

import { closeDatabase, openDatabase } from '../src/db/index.ts';

openDatabase(inject('databaseUrl'), pino({ enabled: false }));
afterAll(closeDatabase);
