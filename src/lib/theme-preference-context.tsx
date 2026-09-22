'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { readStorage, writeStorage } from '@/lib/safe-storage';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme_preference';

// Inline script (rendered in <head>) that applies the saved choice before
// first paint so there is no light→dark flash.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

interface ThemePreferenceContextValue {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    const stored = readStorage(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setPreferenceState(stored);
    }
  }, []);

  function setPreference(pref: ThemePreference) {
    setPreferenceState(pref);
    writeStorage(STORAGE_KEY, pref);
    applyTheme(pref);
  }

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference(): ThemePreferenceContextValue {
  const ctx = useContext(ThemePreferenceContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemePreferenceProvider');
  return ctx;
}
