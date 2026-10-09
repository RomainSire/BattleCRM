import { pino, type DestinationStream, type Level, type Logger } from 'pino';

// Never logged (spec stack §11). Log chosen fields, never a whole object: this list is the safety net.
const SECRET_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'undoToken',
  'code',
  'backupCode',
  'cookie',
  'authorization',
  'headers',
  'body',
];

export function createLogger(level: Level, destination?: DestinationStream): Logger {
  return pino(
    {
      level,
      redact: {
        paths: SECRET_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`]),
        remove: true,
      },
    },
    destination,
  );
}
