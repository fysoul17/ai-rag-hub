'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'autonomy-debug-mode';

export function useDebugMode() {
  const [debugMode, setDebugMode] = useState(false);

  const toggleDebug = useCallback(() => {
    setDebugMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Initialize from localStorage + URL param
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('debug') === 'true';

    if (fromUrl || stored === 'true') {
      setDebugMode(true);
    }
  }, []);

  // Keyboard shortcut: Cmd+Shift+D / Ctrl+Shift+D
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        toggleDebug();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDebug]);

  return { debugMode, toggleDebug };
}
