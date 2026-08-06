import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'asl-game-theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // `<meta name="theme-color">` colors the browser/PWA chrome — the Android status bar, the
    // installed-app task-switcher card, the desktop PWA title bar. index.html sets it once as a
    // static dark value; without this it never changes, so an installed app in light mode still
    // shows a dark-purple status bar clashing with a light page (found during the mobile-native
    // polish pass, 2026-07-29). Reads --rt-body-bg rather than duplicating its hex values here —
    // index.css already owns "what color is the app background per theme"; this only reacts to it.
    // (iOS itself doesn't read this tag — its status-bar-style is fixed at launch, see index.html's
    // comment on apple-mobile-web-app-status-bar-style — but Android Chrome and desktop do, live.)
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    themeColorMeta?.setAttribute('content', getComputedStyle(root).getPropertyValue('--rt-body-bg').trim());
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
  }

  function toggleTheme() {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
