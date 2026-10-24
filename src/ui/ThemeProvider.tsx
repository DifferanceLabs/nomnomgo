import LocalStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { themes, type NomNomGoTheme } from './theme';

export type AppearancePreference = 'system' | 'light' | 'dark';
export const APPEARANCE_STORAGE_KEY = 'nomNomGoAppearanceV1';

export function readAppearancePreference(value: unknown): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveAppearance(preference: AppearancePreference, systemScheme: string | null | undefined) {
  return preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
}

type ThemeContextValue = {
  theme: NomNomGoTheme;
  preference: AppearancePreference;
  ready: boolean;
  saving: boolean;
  error: string;
  setPreference: (preference: AppearancePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  // This subscribes to OS/browser changes without requesting any permission.
  const systemScheme = useColorScheme();
  const [preference, updatePreference] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mode = resolveAppearance(preference, systemScheme);
  const theme = themes[mode];

  useEffect(() => {
    let active = true;
    void LocalStorage.getItem(APPEARANCE_STORAGE_KEY).then((stored) => {
      if (active) updatePreference(readAppearancePreference(stored));
    }).catch(() => {
      if (active) setError('Your saved appearance could not be loaded. Using your device setting.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      void SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
    }
  }, [theme]);

  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  const setPreference = async (next: AppearancePreference) => {
    if (!ready || saving) return;
    const previous = preference;
    updatePreference(next);
    setSaving(true);
    setError('');
    try {
      await LocalStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      updatePreference(previous);
      setError('Appearance could not be saved on this device. Please try again.');
    } finally { setSaving(false); }
  };

  return <ThemeContext.Provider value={{ theme, preference, ready, saving, error, setPreference }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}

// Each immutable palette shares one stylesheet per factory across components.
const styleCache = new WeakMap<(theme: NomNomGoTheme) => object, WeakMap<NomNomGoTheme, object>>();
export function useThemedStyles<T extends object>(factory: (theme: NomNomGoTheme) => T): T {
  const { theme } = useTheme();
  let palettes = styleCache.get(factory);
  if (!palettes) { palettes = new WeakMap(); styleCache.set(factory, palettes); }
  let styles = palettes.get(theme) as T | undefined;
  if (!styles) { styles = factory(theme); palettes.set(theme, styles); }
  return styles;
}
