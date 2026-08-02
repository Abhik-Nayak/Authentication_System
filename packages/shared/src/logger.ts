import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Redaction is not cosmetic: an unredacted `req.headers.authorization` puts a live access
  // token into every log line, and log aggregators are a far softer target than the database.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.totpSecret',
    ],
    censor: '[redacted]',
  },
});

/**
 * Child logger tagged with the gateway's x-request-id, so every line emitted while handling one
 * request can be grepped together across all four services.
 */
export function requestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}
