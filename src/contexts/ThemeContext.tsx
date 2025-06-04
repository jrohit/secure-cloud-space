import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme) {
        return storedTheme;
      }
      return defaultTheme;
    } catch (e) {
      // Ignore localStorage errors (e.g., in private browsing)
      return defaultTheme;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const currentIsDark = root.classList.contains('dark');

    let effectiveTheme = theme;
    if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    if (effectiveTheme === 'dark') {
      if (!currentIsDark) {
        root.classList.add('dark');
      }
    } else {
      if (currentIsDark) {
        root.classList.remove('dark');
      }
    }
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return; // Only listen if theme is 'system'

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // This effect only re-applies the class based on system preference
      // when the *system* theme changes AND current theme is 'system'.
      // The actual state `theme` remains 'system'.
      const root = window.document.documentElement;
      const currentIsDark = root.classList.contains('dark');
      if (mediaQuery.matches) { // System is dark
        if (!currentIsDark) root.classList.add('dark');
      } else { // System is light
        if (currentIsDark) root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]); // Re-run if theme changes to/from 'system'

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      // Ignore localStorage errors
    }
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
