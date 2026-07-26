import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { env } from '@/src/lib/env';

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return new NextResponse('Missing jobId', { status: 400 });
    }

    // Verify webhook secret from RunPod (you can pass it as a query param or header)
    // RunPod doesn't have native webhook signatures like Stripe, so a secret query param is often used.
    // For now, we will trust the jobId UUID acting as a capability URL, but ideally verify a token.

    const payload = await request.json() as {
      status: string;
      output?: { url?: string } | string[];
      executionTime?: number;
      delayTime?: number;
      error?: string;
    };
    const supabase = await createClient();
    
    // Log event
    await supabase.from('generation_events').insert({
      generation_id: jobId,
      event_type: payload.status,
      message: 'RunPod webhook received',
      metadata: payload
    });

    if (payload.status === 'COMPLETED') {
      const outputUrl = Array.isArray(payload.output)
        ? payload.output[0]
        : payload.output?.url; // Depending on template output format

      // Update Job
      await supabase
        .from('generation_jobs')
        .update({
          runpod_status: payload.status,
          output_storage_path: outputUrl, // In a robust app, we download this URL and upload to Supabase Storage
          runpod_execution_ms: payload.executionTime,
          runpod_delay_ms: payload.delayTime,
        })
        .eq('id', jobId);

      // Finalize Charge (Atomic)
      await supabase.rpc('finalize_generation_charge', {
        p_generation_id: jobId
      });

      return new NextResponse('OK', { status: 200 });
    } 
    
    if (payload.status === 'FAILED') {
      // Refund Reservation (Atomic)
      await supabase.rpc('refund_generation_reservation', {
        p_generation_id: jobId,
        p_terminal_status: 'failed'
      });
      
      await supabase
        .from('generation_jobs')
        .update({
          runpod_status: payload.status,
          error_message: payload.error || 'RunPod execution failed',
        })
        .eq('id', jobId);

      return new NextResponse('OK', { status: 200 });
    }

    // IN_PROGRESS etc
    await supabase
      .from('generation_jobs')
      .update({
        runpod_status: payload.status,
      })
      .eq('id', jobId);

    return new NextResponse('OK', { status: 200 });

  } catch (error) {
    console.error('RunPod Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
