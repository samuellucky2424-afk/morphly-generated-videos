import { createAdminClient } from '@/src/lib/supabase/admin';

export type ThemeConfig = {
  bg: string;
  lime: string;
  yellow: string;
};

export const defaultTheme: ThemeConfig = {
  bg: '#080b0a',
  lime: '#dfff45',
  yellow: '#ffd829',
};

export async function getThemeConfig(): Promise<ThemeConfig> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('system_settings')
      .select('value')
      .eq('key', 'theme_config')
      .single();

    if (error || !data?.value) {
      return defaultTheme;
    }

    const theme = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    return {
      bg: theme.bg || defaultTheme.bg,
      lime: theme.lime || defaultTheme.lime,
      yellow: theme.yellow || defaultTheme.yellow,
    };
  } catch (error) {
    console.error('Failed to load theme config:', error);
    return defaultTheme;
  }
}
