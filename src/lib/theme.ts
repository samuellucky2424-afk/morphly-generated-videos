import { createAdminClient } from '@/src/lib/supabase/admin';

export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'lime' | 'red' | 'blue' | 'purple' | 'orange' | 'pink';

export type ThemeConfig = {
  mode: ThemeMode;
  accent: AccentColor;
  bg: string;
  panel: string;
  panel2: string;
  text: string;
  lime: string;
  yellow: string;
};

export const THEME_PRESETS = {
  modes: {
    dark: { bg: '#080b0a', panel: '#0e1210', panel2: '#131814', text: '#f5f7f2' },
    light: { bg: '#ffffff', panel: '#f5f7f2', panel2: '#eaeaea', text: '#111111' },
  },
  accents: {
    lime: { primary: '#dfff45', secondary: '#ffd829' },
    red: { primary: '#990000', secondary: '#cc0000' },
    blue: { primary: '#4da6ff', secondary: '#80bfff' },
    purple: { primary: '#b58aff', secondary: '#d9b3ff' },
    orange: { primary: '#ff9933', secondary: '#ffb366' },
    pink: { primary: '#ff66b3', secondary: '#ff99cc' },
  }
};

export const defaultTheme: ThemeConfig = {
  mode: 'light',
  accent: 'red',
  ...THEME_PRESETS.modes.light,
  lime: THEME_PRESETS.accents.red.primary,
  yellow: THEME_PRESETS.accents.red.secondary,
};

export function computeTheme(mode?: ThemeMode, accent?: AccentColor): ThemeConfig {
  const selectedMode = mode && THEME_PRESETS.modes[mode] ? mode : 'light';
  const selectedAccent = accent && THEME_PRESETS.accents[accent] ? accent : 'red';
  
  return {
    mode: selectedMode,
    accent: selectedAccent,
    ...THEME_PRESETS.modes[selectedMode],
    lime: THEME_PRESETS.accents[selectedAccent].primary,
    yellow: THEME_PRESETS.accents[selectedAccent].secondary,
  };
}

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
    return computeTheme(theme.mode, theme.accent);
  } catch (error) {
    console.error('Failed to load theme config:', error);
    return defaultTheme;
  }
}
