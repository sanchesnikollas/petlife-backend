import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1).default('postgresql://localhost:5432/petlife'),
  JWT_SECRET: z.string().min(10).default('dev-jwt-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(10).default('dev-refresh-secret-change-me'),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default('petlife-uploads'),
  R2_PUBLIC_URL: z.string().default('https://cdn.petlife.app'),
  RESEND_API_KEY: z.string().default(''),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
});

export function loadEnvFromValues(values) {
  const result = envSchema.safeParse(values);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    throw new Error(`Invalid environment variables: ${JSON.stringify(formatted)}`);
  }
  return Object.freeze(result.data);
}

export const env = loadEnvFromValues(process.env);
