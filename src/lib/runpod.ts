import { env } from './env';

interface RunPodInput {
  mode: 'text_to_video' | 'image_to_video' | 'video_to_video';
  prompt: string;
  negative_prompt?: string;
  num_frames: number;
  width: number;
  height: number;
  fps: number;
  duration_seconds: number;
  num_inference_steps: number;
  guidance_scale: number;
  seed?: number;
  image?: string; // For Image to Video
  video?: string; // For Video to Video
  job_id?: string;
  user_id?: string;
  output_bucket?: string;
  output_path?: string;
}

interface RunPodJobResponse {
  id: string;
  status: string;
}

export type RunPodStatusResponse = RunPodJobResponse & {
  delayTime?: number;
  error?: string;
  executionTime?: number;
  output?: unknown;
  progress?: number;
  workerId?: string;
};

export async function submitRunPodJob(jobId: string, input: RunPodInput): Promise<RunPodJobResponse> {
  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;
  
  // Use our App URL for the webhook
  const webhookUrl =
    `${env.APP_URL}/api/webhooks/runpod?jobId=${jobId}` +
    `&secret=${encodeURIComponent(env.RUNPOD_WEBHOOK_SECRET)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input,
      webhook: webhookUrl,
      policy: {
        executionTimeout: 900000,
        ttl: 3600000,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RunPod API Error:', errorText);
    throw new Error('Failed to submit job to RunPod');
  }

  const data = await response.json() as RunPodJobResponse;
  if (!data.id || typeof data.id !== 'string') {
    throw new Error('RunPod did not return a job identifier');
  }
  return data;
}

export async function cancelRunPodJob(runpodJobId: string) {
  const response = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/cancel/${encodeURIComponent(runpodJobId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error('RunPod job cancellation failed');
  }
}

export async function getRunPodJobStatus(
  runpodJobId: string,
): Promise<RunPodStatusResponse | null> {
  const response = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${encodeURIComponent(runpodJobId)}`,
    {
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
      cache: 'no-store',
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`RunPod status request failed with ${response.status}`);
  }

  return (await response.json()) as RunPodStatusResponse;
}
