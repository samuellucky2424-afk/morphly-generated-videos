import { NextResponse } from 'next/server';
import { requireUser } from '@/src/lib/auth';
import { createClient } from '@/src/lib/supabase/server';
import { submitRunPodJob } from '@/src/lib/runpod';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    
    // Fetch user jobs ordered by newest
    const { data, error } = await supabase
      .from('generation_jobs')
      .select('*, generation_presets(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') return new NextResponse('Unauthorized', { status: 401 });
    console.error('Error fetching jobs:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { presetId, prompt, negativePrompt, sourceAssetPath } = await request.json();

    if (!presetId || !prompt) {
      return NextResponse.json({ error: 'presetId and prompt are required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch Preset
    const { data: preset, error: presetError } = await supabase
      .from('generation_presets')
      .select('*')
      .eq('id', presetId)
      .eq('is_active', true)
      .single();

    if (presetError || !preset) {
      return NextResponse.json({ error: 'Invalid or inactive preset' }, { status: 400 });
    }

    const clientRequestId = uuidv4();
    const idempotencyKey = `gen-reserve:${clientRequestId}`;

    // 2. Create Job in Supabase
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        user_id: user.id,
        preset_id: preset.id,
        action: preset.action,
        prompt: prompt,
        negative_prompt: negativePrompt || null,
        source_asset_path: sourceAssetPath || null,
        credit_cost: preset.credit_cost,
        client_request_id: clientRequestId,
        request_snapshot: preset,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Job creation error:', jobError);
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 });
    }

    // 3. Lock Wallet Credits (Atomic)
    const { error: reserveError } = await supabase.rpc('reserve_generation_credits', {
      p_user_id: user.id,
      p_generation_id: job.id,
      p_required_credits: preset.credit_cost,
      p_idempotency_key: idempotencyKey,
    });

    if (reserveError) {
      console.error('Credit reservation error:', reserveError);
      // Refund or mark job failed here technically since it didn't reserve. 
      // But actually if reserve fails, the job just stays 'created' and never runs.
      await supabase.from('generation_jobs').update({ status: 'failed', error_message: reserveError.message }).eq('id', job.id);
      return NextResponse.json({ error: reserveError.message }, { status: 402 }); // Payment Required
    }

    // 4. Send to RunPod
    try {
      const runpodResponse = await submitRunPodJob(job.id, {
        prompt: prompt,
        negative_prompt: negativePrompt || '',
        num_frames: preset.frames,
        width: preset.width,
        height: preset.height,
        num_inference_steps: preset.inference_steps,
        guidance_scale: preset.guidance_scale,
        // if mode is image_to_video, we'd pass image: sourceAssetPath, etc.
      });

      // 5. Update Job with RunPod ID
      await supabase
        .from('generation_jobs')
        .update({
          runpod_job_id: runpodResponse.id,
          runpod_status: runpodResponse.status,
          status: 'processing',
          submitted_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json({ job_id: job.id, runpod_job_id: runpodResponse.id });
    } catch (runpodError: any) {
      console.error('RunPod submission error:', runpodError);
      
      // Atomic Refund
      await supabase.rpc('refund_generation_reservation', {
        p_generation_id: job.id,
        p_terminal_status: 'failed'
      });

      await supabase.from('generation_jobs').update({
        error_message: 'Failed to communicate with GPU cluster',
      }).eq('id', job.id);

      return NextResponse.json({ error: 'GPU allocation failed. Credits refunded.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Generation POST error:', error);
    if (error.message === 'NEXT_REDIRECT') return new NextResponse('Unauthorized', { status: 401 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
