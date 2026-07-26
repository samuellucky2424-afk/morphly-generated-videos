import { calculateLtxFrameCount } from './generation-timing.ts';

export {
  DEFAULT_DURATION_OPTION_ID,
  DURATION_OPTION_IDS,
  DURATION_OPTIONS,
  getDurationOption,
  getDurationOptionBySeconds,
  resolveDurationOption,
  type DurationOptionId,
} from './generation-timing.ts';

export const GENERATION_MODES = [
  'text_to_video',
  'image_to_video',
  'video_to_video',
] as const;

export type GenerationMode = (typeof GENERATION_MODES)[number];

export const RESOLUTION_OPTIONS = [
  {
    key: 'square-512',
    label: '512 × 512',
    aspectRatio: '1:1',
    width: 512,
    height: 512,
    costMultiplier: 0.8,
  },
  {
    key: 'landscape-720',
    label: '768 × 448',
    aspectRatio: '12:7',
    width: 768,
    height: 448,
    costMultiplier: 1,
  },
  {
    key: 'portrait-720',
    label: '448 × 768',
    aspectRatio: '7:12',
    width: 448,
    height: 768,
    costMultiplier: 1,
  },
  {
    key: 'landscape-1080',
    label: '1024 × 576',
    aspectRatio: '16:9',
    width: 1024,
    height: 576,
    costMultiplier: 1.5,
  },
  {
    key: 'portrait-1080',
    label: '576 × 1024',
    aspectRatio: '9:16',
    width: 576,
    height: 1024,
    costMultiplier: 1.5,
  },
] as const;

export type ResolutionKey = (typeof RESOLUTION_OPTIONS)[number]['key'];

const MODE_CREDITS_PER_SECOND: Record<GenerationMode, number> = {
  text_to_video: 10,
  image_to_video: 10,
  video_to_video: 12,
};

const FPS_MULTIPLIERS: Record<number, number> = {
  8: 1,
};

export function getResolution(key: string) {
  return RESOLUTION_OPTIONS.find((option) => option.key === key) ?? null;
}

export function getPresetMultiplier(slug: string) {
  if (slug.endsWith('pro') || slug === 'pro') {
    return 1.5;
  }

  if (slug.endsWith('preview') || slug === 'preview') {
    return 0.65;
  }

  return 1;
}

export function calculateGenerationCost({
  durationSeconds,
  fps,
  mode,
  presetSlug,
  resolutionKey,
}: {
  durationSeconds: number;
  fps: number;
  mode: GenerationMode;
  presetSlug: string;
  resolutionKey: string;
}) {
  const resolution = getResolution(resolutionKey);

  if (!resolution || !FPS_MULTIPLIERS[fps]) {
    return null;
  }

  return Math.max(
    1,
    Math.ceil(
      MODE_CREDITS_PER_SECOND[mode] *
        durationSeconds *
        resolution.costMultiplier *
        FPS_MULTIPLIERS[fps] *
        getPresetMultiplier(presetSlug),
    ),
  );
}

export function calculateFrameCount(durationSeconds: number, fps: number) {
  return calculateLtxFrameCount(durationSeconds, fps);
}
