import { NextRequest, NextResponse } from 'next/server';
import { getAdminAccess } from '@/src/lib/admin-auth';
import { createAdminClient } from '@/src/lib/supabase/admin';
import { defaultTheme } from '@/src/lib/theme';

export async function GET() {
  try {
    const access = await getAdminAccess();
    if (!access.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = createAdminClient();
    
    const { data, error } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'theme_config')
      .single();

    if (error || !data?.value) {
      return NextResponse.json(defaultTheme);
    }
    
    const theme = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return NextResponse.json(theme);
  } catch (error) {
    console.error('Failed to get theme config:', error);
    return NextResponse.json({ error: 'Failed to get theme configuration' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await getAdminAccess();
    if (!access.authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = (await request.json()) as any;
    
    // Ensure we are saving only valid theme fields
    const newTheme = {
      bg: body.bg || defaultTheme.bg,
      panel: body.panel || defaultTheme.panel,
      panel2: body.panel2 || defaultTheme.panel2,
      text: body.text || defaultTheme.text,
      lime: body.lime || defaultTheme.lime,
      yellow: body.yellow || defaultTheme.yellow,
    };

    const admin = createAdminClient();
    
    const { error } = await admin
      .from('system_settings')
      .upsert(
        { 
          key: 'theme_config', 
          value: newTheme, 
          description: 'UI color theme configuration', 
          is_public: true 
        }, 
        { onConflict: 'key' }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json(newTheme);
  } catch (error) {
    console.error('Failed to update theme config:', error);
    return NextResponse.json({ error: 'Failed to update theme configuration' }, { status: 500 });
  }
}
