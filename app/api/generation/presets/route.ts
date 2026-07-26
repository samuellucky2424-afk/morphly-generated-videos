import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('generation_presets')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('sort_order');

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching presets:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
