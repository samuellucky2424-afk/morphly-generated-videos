import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_VIDEO_BUCKET: z.string().min(1),
  RUNPOD_ENDPOINT_ID: z.string().min(1),
  RUNPOD_API_KEY: z.string().min(1),
  RUNPOD_WEBHOOK_SECRET: z.string().min(1),
  FLW_PUBLIC_KEY: z.string().min(1),
  FLW_SECRET_KEY: z.string().min(1),
  FLW_SECRET_HASH: z.string().min(1),
  APP_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_VIDEO_BUCKET: process.env.SUPABASE_VIDEO_BUCKET,
  RUNPOD_ENDPOINT_ID: process.env.RUNPOD_ENDPOINT_ID,
  RUNPOD_API_KEY: process.env.RUNPOD_API_KEY,
  RUNPOD_WEBHOOK_SECRET: process.env.RUNPOD_WEBHOOK_SECRET,
  FLW_PUBLIC_KEY: process.env.FLW_PUBLIC_KEY,
  FLW_SECRET_KEY: process.env.FLW_SECRET_KEY,
  FLW_SECRET_HASH: process.env.FLW_SECRET_HASH,
  APP_URL: process.env.APP_URL,
  CRON_SECRET: process.env.CRON_SECRET,
});
