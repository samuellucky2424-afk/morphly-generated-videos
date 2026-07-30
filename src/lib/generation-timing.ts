export const DURATION_OPTIONS = [
  { id: 'duration-4', label: '4 seconds', seconds: 4 },
  { id: 'duration-8', label: '8 seconds', seconds: 8 },
  { id: 'duration-10', label: '10 seconds', seconds: 10 },
  { id: 'duration-20', label: '20 seconds', seconds: 20 },
] as const;

export type DurationOptionId = (typeof DURATION_OPTIONS)[number]['id'];

export const DURATION_OPTION_IDS = DURATION_OPTIONS.map(
  (option) => option.id,
) as [DurationOptionId, ...DurationOptionId[]];

export const DEFAULT_DURATION_OPTION_ID: DurationOptionId = 'duration-8';
export const DURATION_TOLERANCE_SECONDS = 0.4;

export type RunPodOutputTiming = {
  actualDurationSeconds: number;
  fps: number;
  frames: number;
  requestedDurationSeconds: number;
};

export type CompletionTimingValidation =
  | {
      metadata: RunPodOutputTiming;
      ok: true;
    }
  | {
      metadata: RunPodOutputTiming | null;
      ok: false;
      reason:
        | 'actual-duration-mismatch'
        | 'fps-mismatch'
        | 'frame-count-mismatch'
        | 'missing-output-timing'
        | 'requested-duration-mismatch';
    };

export function getDurationOption(id: string) {
  return DURATION_OPTIONS.find((option) => option.id === id) ?? null;
}

export function getDurationOptionBySeconds(seconds: number) {
  return DURATION_OPTIONS.find((option) => option.seconds === seconds) ?? null;
}

export function resolveDurationOption({
  durationOption,
  durationSeconds,
}: {
  durationOption?: string;
  durationSeconds?: number;
}) {
  if (durationOption) {
    return getDurationOption(durationOption);
  }

  return typeof durationSeconds === 'number'
    ? getDurationOptionBySeconds(durationSeconds)
    : null;
}

export function calculateLtxFrameCount(
  durationSeconds: number,
  fps: number,
) {
  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isInteger(fps) ||
    fps <= 0
  ) {
    throw new RangeError('Duration and FPS must be positive integers.');
  }

  return Math.ceil(((durationSeconds * fps) - 1) / 8) * 8 + 1;
}

function toFiniteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function extractRunPodOutputTiming(
  value: unknown,
): RunPodOutputTiming | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const metadata = extractRunPodOutputTiming(item);
      if (metadata) return metadata;
    }
    return null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const requestedDurationSeconds = toFiniteNumber(
    record.requested_duration_seconds,
  );
  const actualDurationSeconds = toFiniteNumber(
    record.actual_duration_seconds,
  );
  const frames = toFiniteNumber(record.frames);
  const fps = toFiniteNumber(record.fps);

  if (
    requestedDurationSeconds !== null &&
    requestedDurationSeconds > 0 &&
    actualDurationSeconds !== null &&
    actualDurationSeconds > 0 &&
    frames !== null &&
    Number.isInteger(frames) &&
    frames > 0 &&
    fps !== null &&
    Number.isInteger(fps) &&
    fps > 0
  ) {
    return {
      actualDurationSeconds,
      fps,
      frames,
      requestedDurationSeconds,
    };
  }

  for (const key of ['metadata', 'output', 'result', 'timing']) {
    const metadata = extractRunPodOutputTiming(record[key]);
    if (metadata) return metadata;
  }

  return null;
}

export function validateCompletionTiming({
  expectedFps,
  expectedFrames,
  expectedRequestedDurationSeconds,
  output,
}: {
  expectedFps: number;
  expectedFrames: number;
  expectedRequestedDurationSeconds: number;
  output: unknown;
}): CompletionTimingValidation {
  const metadata = extractRunPodOutputTiming(output);

  if (!metadata) {
    return {
      metadata: null,
      ok: false,
      reason: 'missing-output-timing',
    };
  }

  return {
    metadata,
    ok: true,
  };
}
