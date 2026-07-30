-- seed.sql

INSERT INTO system_settings (key, value, description, is_public) VALUES
('system_config', '{
  "signup_bonus_credits": 70,
  "referral_referrer_bonus_credits": 200,
  "referral_referee_bonus_credits": 0,
  "generation_maintenance_mode": false,
  "default_signed_url_ttl_seconds": 3600,
  "max_active_jobs_per_user": 2,
  "max_prompt_length": 2000,
  "runpod_gpu_hourly_rate_usd": 3.49,
  "job_execution_timeout_ms": 900000,
  "job_total_ttl_ms": 3600000
}', 'Global system configuration', true),
('theme_config', '{
  "bg": "#080b0a",
  "lime": "#dfff45",
  "yellow": "#ffd829"
}', 'UI color theme configuration', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO credit_packages (name, slug, description, price_minor, currency, base_credits, bonus_credits, sort_order) VALUES
('Starter', 'starter', 'Perfect for quick tests.', 500000, 'NGN', 300, 0, 1),
('Creator', 'creator', 'For active creators.', 1000000, 'NGN', 600, 50, 2),
('Pro', 'pro', 'For professional workflows.', 2000000, 'NGN', 1200, 150, 3),
('Studio', 'studio', 'For agencies and power users.', 5000000, 'NGN', 3000, 500, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO generation_presets (name, slug, description, action, width, height, frames, fps, inference_steps, guidance_scale, credit_cost, feature_flag, is_public, is_active, sort_order) VALUES
('Preview', 'preview', 'Fast draft render for testing motion.', 'text_to_video', 768, 448, 105, 25, 8, 1.0, 20, 'text_to_video_enabled', true, true, 1),
('Standard', 'standard', 'Balanced quality for everyday creation.', 'text_to_video', 768, 448, 201, 25, 40, 3.5, 50, 'text_to_video_enabled', true, true, 2),
('Pro', 'pro', 'Higher-detail cinematic generation.', 'text_to_video', 1024, 576, 257, 25, 50, 4.0, 120, 'text_to_video_enabled', true, true, 3)
ON CONFLICT (slug) DO NOTHING;
