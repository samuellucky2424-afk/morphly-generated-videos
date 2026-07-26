import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLtxFrameCount,
  validateCompletionTiming,
} from '../src/lib/generation-timing.ts';

test('8 seconds at 8 FPS produces 65 LTX frames', () => {
  assert.equal(calculateLtxFrameCount(8, 8), 65);
});

test('10 seconds at 8 FPS produces 81 LTX frames', () => {
  assert.equal(calculateLtxFrameCount(10, 8), 81);
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
