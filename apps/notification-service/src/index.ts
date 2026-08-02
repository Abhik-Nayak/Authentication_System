import { logger } from '@secure-notes/shared';
import { app } from './app';
import { config } from './config';

const server = app.listen(config.NOTIFICATION_PORT, () => {
  logger.info({ port: config.NOTIFICATION_PORT }, 'notification-service listening');
});

// Without this, a rolling deploy kills in-flight requests: Kubernetes sends SIGTERM and the
// process dies immediately, so an email accepted a millisecond earlier is never sent.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutting down');
    server.close(() => process.exit(0));
  });
}
