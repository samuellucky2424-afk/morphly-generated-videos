-- 0006_functional_creator_dashboard.sql
--
-- Add durable user assets, configurable generation metadata, safe profile
-- preferences, and active presets for all three LTX generation modes.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS company text,
    ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS generation_notifications boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Users can update own profile safely" ON profiles;

CREATE TABLE IF NOT EXISTS assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bucket text NOT NULL,
    storage_path text NOT NULL UNIQUE,
    kind text NOT NULL CHECK (
        kind IN ('source_image', 'source_video', 'generated_video', 'thumbnail', 'avatar')
    ),
    original_name text,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    width integer,
    height integer,
    duration_seconds numeric,
    status text NOT NULL DEFAULT 'uploading' CHECK (
        status IN ('uploading', 'ready', 'failed')
    ),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS assets_user_created_idx
    ON assets (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own assets" ON assets;
CREATE POLICY "Users can view own assets" ON assets
    FOR SELECT
    USING (auth.uid() = user_id);

ALTER TABLE generation_jobs
    ADD COLUMN IF NOT EXISTS title text,
    ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'ltx-2.3',
    ADD COLUMN IF NOT EXISTS aspect_ratio text NOT NULL DEFAULT '1:1',
    ADD COLUMN IF NOT EXISTS duration_seconds integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS fps integer NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 256,
    ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 256,
    ADD COLUMN IF NOT EXISTS frames integer NOT NULL DEFAULT 9,
    ADD COLUMN IF NOT EXISTS seed bigint,
    ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS output_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS generation_jobs_user_visible_idx
    ON generation_jobs (user_id, created_at DESC)
    WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'generation_jobs_duration_seconds_check'
    ) THEN
        ALTER TABLE generation_jobs
            ADD CONSTRAINT generation_jobs_duration_seconds_check
            CHECK (duration_seconds BETWEEN 1 AND 20);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'generation_jobs_dimensions_check'
    ) THEN
        ALTER TABLE generation_jobs
            ADD CONSTRAINT generation_jobs_dimensions_check
            CHECK (
                width BETWEEN 256 AND 2048
                AND height BETWEEN 256 AND 2048
                AND fps BETWEEN 8 AND 60
                AND frames BETWEEN 9 AND 1201
            );
    END IF;
END
$$;

INSERT INTO generation_presets (
    name,
    slug,
    description,
    action,
    width,
    height,
    frames,
    fps,
    inference_steps,
    guidance_scale,
    credit_cost,
    feature_flag,
    is_public,
    is_active,
    sort_order
) VALUES
    ('Preview', 'preview', 'Fast draft render for testing motion.', 'text_to_video', 768, 432, 73, 24, 8, 3.0, 20, 'text_to_video_enabled', true, true, 1),
    ('Standard', 'standard', 'Balanced quality for everyday creation.', 'text_to_video', 768, 432, 121, 24, 20, 5.0, 50, 'text_to_video_enabled', true, true, 2),
    ('Pro', 'pro', 'Higher-detail cinematic generation.', 'text_to_video', 1024, 576, 193, 24, 30, 6.5, 120, 'text_to_video_enabled', true, true, 3),
    ('Preview', 'image-preview', 'Fast motion test from a source image.', 'image_to_video', 768, 432, 73, 24, 8, 3.0, 20, 'image_to_video_enabled', true, true, 11),
    ('Standard', 'image-standard', 'Balanced image animation quality.', 'image_to_video', 768, 432, 121, 24, 20, 5.0, 50, 'image_to_video_enabled', true, true, 12),
    ('Pro', 'image-pro', 'Higher-detail image animation.', 'image_to_video', 1024, 576, 193, 24, 30, 6.5, 120, 'image_to_video_enabled', true, true, 13),
    ('Preview', 'video-preview', 'Fast style and motion test from footage.', 'video_to_video', 768, 432, 73, 24, 8, 3.0, 24, 'video_to_video_enabled', true, true, 21),
    ('Standard', 'video-standard', 'Balanced video transformation quality.', 'video_to_video', 768, 432, 121, 24, 20, 5.0, 60, 'video_to_video_enabled', true, true, 22),
    ('Pro', 'video-pro', 'Higher-detail footage transformation.', 'video_to_video', 1024, 576, 193, 24, 30, 6.5, 144, 'video_to_video_enabled', true, true, 23)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    action = EXCLUDED.action,
    width = EXCLUDED.width,
    height = EXCLUDED.height,
    frames = EXCLUDED.frames,
    fps = EXCLUDED.fps,
    inference_steps = EXCLUDED.inference_steps,
    guidance_scale = EXCLUDED.guidance_scale,
    credit_cost = EXCLUDED.credit_cost,
    feature_flag = EXCLUDED.feature_flag,
    is_public = true,
    is_active = true,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
) VALUES (
    'morphly-generated-videos',
    'morphly-generated-videos',
    false,
    209715200,
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
