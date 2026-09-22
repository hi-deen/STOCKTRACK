'use client';

import { useEffect } from 'react';

// Web equivalent of expo-router's useFocusEffect: run the (memoised) callback
// on mount, whenever its identity changes (e.g. the active business switched),
// and whenever the tab/window regains focus, so a screen always shows fresh
// data when the user comes back to it. Pass a useCallback, as on mobile.
export function useFocusEffect(callback: () => void) {
  useEffect(() => {
    callback();
    const run = () => {
      if (document.visibilityState === 'visible') callback();
    };
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [callback]);
}
