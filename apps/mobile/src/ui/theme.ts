import { Uniwind, useUniwind } from 'uniwind';

import type { ThemePreference } from '@/modules/settings/settings.store';

export type ResolvedTheme = 'light' | 'dark';

export const loopTodoPalettes = {
  light: {
    background: '#F6F7F9',
    surface: '#FFFFFF',
    surfaceSecondary: '#F0F2F5',
    text: '#17181A',
    textMuted: '#686C73',
    separator: '#E7E9ED',
    accent: '#2563EB',
    accentSoft: '#EAF1FF',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    disabled: '#A3A3A3',
    chartGrid: '#E7E9ED',
  },
  dark: {
    background: '#101114',
    surface: '#191B20',
    surfaceSecondary: '#22252B',
    text: '#F2F3F5',
    textMuted: '#A4A8B0',
    separator: '#2D3037',
    accent: '#5B8CFF',
    accentSoft: '#1C2B4D',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    disabled: '#666B75',
    chartGrid: '#2D3037',
  },
} as const;

export function normalizeResolvedTheme(themeName: string): ResolvedTheme {
  return themeName === 'dark' ? 'dark' : 'light';
}

export function applyThemePreference(preference: ThemePreference) {
  Uniwind.setTheme(preference);
}

export function useLoopTodoTheme() {
  const { theme: themeName } = useUniwind();
  const mode = normalizeResolvedTheme(themeName);
  return { mode, dark: mode === 'dark', colors: loopTodoPalettes[mode] };
}

export const theme = {
  spacing: { xs: 8, sm: 12, md: 16, lg: 24 },
  colors: {
    primary: loopTodoPalettes.light.accent,
    success: loopTodoPalettes.light.success,
    warning: loopTodoPalettes.light.warning,
    danger: loopTodoPalettes.light.danger,
    disabled: loopTodoPalettes.light.disabled,
    lightBackground: loopTodoPalettes.light.background,
    darkBackground: loopTodoPalettes.dark.background,
  },
} as const;
