import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// Dev convenience only: services run on the host via `npm run dev`, whose cwd is this package,
// so the monorepo-root .env has to be pointed at explicitly. In Docker and Kubernetes the file
// does not exist and dotenv silently does nothing — the environment comes from the platform.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  NOTIFICATION_PORT: z.coerce.number().int().positive().default(4004),

  // Shared secret proving the caller is inside the network. Length floor is not decoration:
  // a short key is brute-forceable over an internal network.
  INTERNAL_API_KEY: z.string().min(16),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail at boot, not at the first request. A service that starts with a missing SMTP_HOST and
  // only discovers it when a user registers is strictly worse than one that refuses to start.
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment for notification-service:\n${issues}`);
  process.exit(1);
}

export const config = parsed.data;
