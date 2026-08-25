'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
};

const THEME_STORAGE_KEY = 'crm-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (
    storedTheme === 'light' ||
    storedTheme === 'dark' ||
    storedTheme === 'system'
  ) {
    return storedTheme;
  }

  return 'light';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(resolvedTheme: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);

    const nextResolvedTheme =
      nextTheme === 'system' ? getSystemTheme() : nextTheme;
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
  }, []);

  useEffect(() => {
    const storedTheme = getStoredTheme();
    const nextResolvedTheme =
      storedTheme === 'system' ? getSystemTheme() : storedTheme;

    setThemeState(storedTheme);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(nextResolvedTheme);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme !== 'system') {
        return;
      }

      const nextResolvedTheme = getSystemTheme();
      setResolvedTheme(nextResolvedTheme);
      applyTheme(nextResolvedTheme);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
