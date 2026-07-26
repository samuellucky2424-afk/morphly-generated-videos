import { env } from './env';

interface RunPodInput {
  prompt: string;
  negative_prompt?: string;
  num_frames: number;
  width: number;
  height: number;
  num_inference_steps: number;
  guidance_scale: number;
  seed?: number;
  image?: string; // For Image to Video
  video?: string; // For Video to Video
}

export async function submitRunPodJob(jobId: string, input: RunPodInput) {
  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`;
  
  // Use our App URL for the webhook
  const webhookUrl = `${env.APP_URL}/api/webhooks/runpod?jobId=${jobId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
    },
    body: JSON.stringify({
      input,
      webhook: webhookUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('RunPod API Error:', errorText);
    throw new Error('Failed to submit job to RunPod');
  }

  const data = await response.json();
  return data; // contains id (runpod_job_id) and status
}
