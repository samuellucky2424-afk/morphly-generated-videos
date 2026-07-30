-- 0009_fix_ltx23_generation_presets.sql
--
-- Fixes critical parameter mismatches in generation presets.
--
-- Problems fixed:
--   • fps was 24 — LTX 2.3 generates at 8 FPS natively
--   • height 432 was not divisible by 64 — changed to 448
--   • inference_steps and guidance_scale did not match distilled-LoRA
--     vs full-model requirements
--   • frame counts recalculated using the LTX formula: ceil((dur*fps - 1)/8)*8 + 1
--
-- Frame reference at 8 FPS:
--   4 seconds → 33 frames   (ceil((32-1)/8)*8+1)
--   8 seconds → 65 frames   (ceil((64-1)/8)*8+1)
--  10 seconds → 81 frames   (ceil((80-1)/8)*8+1)

-- ============================================================
-- Text-to-video presets
-- ============================================================

-- Preview: distilled LoRA fast preview (4 seconds)
UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 33,
    inference_steps = 8,
    guidance_scale  = 1.0,
    updated_at      = now()
WHERE slug = 'preview';

-- Standard: full model balanced quality (8 seconds)
UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 65,
    inference_steps = 40,
    guidance_scale  = 3.5,
    updated_at      = now()
WHERE slug = 'standard';

-- Pro: full model high quality (10 seconds)
UPDATE generation_presets SET
    width           = 1024,
    height          = 576,
    fps             = 8,
    frames          = 81,
    inference_steps = 50,
    guidance_scale  = 4.0,
    updated_at      = now()
WHERE slug = 'pro';

-- ============================================================
-- Image-to-video presets
-- ============================================================

UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 33,
    inference_steps = 8,
    guidance_scale  = 1.0,
    updated_at      = now()
WHERE slug = 'image-preview';

UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 65,
    inference_steps = 40,
    guidance_scale  = 3.5,
    updated_at      = now()
WHERE slug = 'image-standard';

UPDATE generation_presets SET
    width           = 1024,
    height          = 576,
    fps             = 8,
    frames          = 81,
    inference_steps = 50,
    guidance_scale  = 4.0,
    updated_at      = now()
WHERE slug = 'image-pro';

-- ============================================================
-- Video-to-video presets
-- ============================================================

UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 33,
    inference_steps = 8,
    guidance_scale  = 1.0,
    updated_at      = now()
WHERE slug = 'video-preview';

UPDATE generation_presets SET
    width           = 768,
    height          = 448,
    fps             = 8,
    frames          = 65,
    inference_steps = 40,
    guidance_scale  = 3.5,
    updated_at      = now()
WHERE slug = 'video-standard';

UPDATE generation_presets SET
    width           = 1024,
    height          = 576,
    fps             = 8,
    frames          = 81,
    inference_steps = 50,
    guidance_scale  = 4.0,
    updated_at      = now()
WHERE slug = 'video-pro';
