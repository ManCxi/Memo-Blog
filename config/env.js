const { z } = require('zod');
const dotenv = require('dotenv');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DB_DIALECT: z.enum(['sqlite', 'mysql', 'postgres']).default('sqlite'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters long'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  REDIS_URL: z.string().url().optional(),
  TRUST_PROXY: z.string().optional(),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().min(6).default('123456'),
  MAX_UPLOAD_SIZE: z.string().transform(Number).default('5242880'), // 5MB
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(result.error.format(), null, 2)
  );
  process.exit(1);
}

module.exports = result.data;
