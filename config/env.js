import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URL: z.string().url({ message: 'MONGODB_URL must be a valid MongoDB connection string' }),
  JWT_SECRET: z.string().min(32, { message: 'JWT_SECRET must be at least 32 characters' }),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, 'JWT_REFRESH_EXPIRES_IN must use seconds, minutes, hours, or days (for example 7d)').default('7d'),
  COOKIE_SECRET: z.string().min(32, { message: 'COOKIE_SECRET must be at least 32 characters' }),
  AWS_ACCESS_KEY_ID: z.string().min(1, { message: 'AWS_ACCESS_KEY_ID is required' }),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, { message: 'AWS_SECRET_ACCESS_KEY is required' }),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_PUBLIC_BUCKET: z.string().min(1, { message: 'AWS_PUBLIC_BUCKET is required' }),
  AWS_PRIVATE_BUCKET: z.string().min(1, { message: 'AWS_PRIVATE_BUCKET is required' }),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  OPENAI_API_KEY: z.string().optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    const errors = Object.entries(formatted)
      .filter(([key]) => key !== '_errors')
      .map(([key, value]) => {
        const errs = value && typeof value === 'object' && '_errors' in value ? value._errors : [];
        return `  ${key}: ${errs.join(', ')}`;
      })
      .filter(e => !e.endsWith(':'));

    console.error('\n❌ Environment validation failed:\n');
    errors.forEach(e => console.error(e));
    console.error('\n💡 Copy .env.example to .env and fill in the values\n');
    process.exit(1);
  }

  return result.data;
}

const env = validateEnv();

export default env;
