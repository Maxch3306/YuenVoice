import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from project root (../../.. from src/config/)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '..', '.env') })

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3001,
  apiPrefix: process.env.API_PREFIX || '/api',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/yuenvoice',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',

  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@yuenvoice.app',

  uploadProvider: process.env.UPLOAD_PROVIDER || 'local',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  uploadMaxSize: Number(process.env.UPLOAD_MAX_SIZE) || 10485760,

  s3Bucket: process.env.S3_BUCKET || '',
  s3Region: process.env.S3_REGION || '',
  s3AccessKey: process.env.S3_ACCESS_KEY || '',
  s3SecretKey: process.env.S3_SECRET_KEY || '',

  adminEmail: process.env.ADMIN_EMAIL || 'admin@yuenvoice.app',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  adminName: process.env.ADMIN_NAME || 'System Admin',
} as const
