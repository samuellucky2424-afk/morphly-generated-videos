import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLtxFrameCount,
  resolveDurationOption,
  validateCompletionTiming,
} from '../src/lib/generation-timing.ts';
import { RESOLUTION_OPTIONS } from '../src/lib/generation-config.ts';

test('8 seconds at 8 FPS produces 65 LTX frames', () => {
  assert.equal(calculateLtxFrameCount(8, 8), 65);
});

test('10 seconds at 8 FPS produces 81 LTX frames', () => {
  assert.equal(calculateLtxFrameCount(10, 8), 81);
});

test('every generation resolution is valid for the two-stage LTX pipeline', () => {
  for (const resolution of RESOLUTION_OPTIONS) {
    assert.equal(resolution.width % 64, 0, `${resolution.key} width`);
    assert.equal(resolution.height % 64, 0, `${resolution.key} height`);
  }
});

test('a stale 8-second client maps to the server-owned duration option', () => {
  assert.equal(
    resolveDurationOption({ durationSeconds: 8 })?.id,
    'duration-8',
  );
  assert.equal(resolveDurationOption({ durationSeconds: 7 }), null);
});

test('matching generation and export timing is accepted', () => {
  const result = validateCompletionTiming({
    expectedFps: 8,
    expectedFrames: 65,
    expectedRequestedDurationSeconds: 8,
    output: {
      requested_duration_seconds: 8,
      actual_duration_seconds: 8.125,
      frames: 65,
      fps: 8,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.metadata?.fps, 8);
});

test('an 8-second request cannot silently complete as a 4-second video', () => {
  const result = validateCompletionTiming({
    expectedFps: 8,
    expectedFrames: 65,
    expectedRequestedDurationSeconds: 8,
    output: {
      requested_duration_seconds: 8,
      actual_duration_seconds: 4,
      frames: 65,
      fps: 8,
    },
  });

  assert.deepEqual(result, {
    metadata: {
      actualDurationSeconds: 4,
      fps: 8,
      frames: 65,
      requestedDurationSeconds: 8,
    },
    ok: false,
    reason: 'actual-duration-mismatch',
  });
});
