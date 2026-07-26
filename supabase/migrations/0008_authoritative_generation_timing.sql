-- 0008_authoritative_generation_timing.sql
--
-- Make requested and measured video duration explicit, and align every active
-- public LTX preset on the authoritative 8 FPS timing contract. Application
-- code calculates the final 8n + 1 frame count from the chosen duration.

ALTER TABLE generation_jobs
    ADD COLUMN IF NOT EXISTS requested_duration_seconds numeric(8, 3),
    ADD COLUMN IF NOT EXISTS actual_duration_seconds numeric(8, 3);

UPDATE generation_jobs
SET requested_duration_seconds = duration_seconds
WHERE requested_duration_seconds IS NULL;

ALTER TABLE generation_jobs
    ALTER COLUMN duration_seconds SET DEFAULT 8,
    ALTER COLUMN requested_duration_seconds SET DEFAULT 8,
    ALTER COLUMN requested_duration_seconds SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'generation_jobs_requested_duration_check'
    ) THEN
        ALTER TABLE generation_jobs
            ADD CONSTRAINT generation_jobs_requested_duration_check
            CHECK (
                requested_duration_seconds > 0
                AND requested_duration_seconds <= 60
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'generation_jobs_actual_duration_check'
    ) THEN
        ALTER TABLE generation_jobs
            ADD CONSTRAINT generation_jobs_actual_duration_check
            CHECK (
                actual_duration_seconds IS NULL
                OR (
                    actual_duration_seconds > 0
                    AND actual_duration_seconds <= 60.25
                )
            );
    END IF;
END
$$;

UPDATE generation_presets
SET
    fps = 8,
    frames = 65,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'duration_options_seconds', jsonb_build_array(4, 8, 10),
        'timing_authority', 'server'
    ),
    updated_at = now()
WHERE is_active = true
  AND is_public = true
  AND action IN ('text_to_video', 'image_to_video', 'video_to_video');

COMMENT ON COLUMN generation_jobs.requested_duration_seconds
IS 'Server-resolved duration requested from the selected duration option.';

COMMENT ON COLUMN generation_jobs.actual_duration_seconds
IS 'Measured MP4 duration reported by the RunPod worker after encoding.';

NOTIFY pgrst, 'reload schema';
