'use client';

import type { PageDefinition } from '@autonomy/shared';
import { useEffect, useState } from 'react';
import { getCustomPages } from '@/lib/api';

export function useCustomPages() {
  const [pages, setPages] = useState<PageDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getCustomPages('active')
      .then((data) => {
        if (!cancelled) setPages(data);
      })
      .catch(() => {
        // Silently fail — sidebar still renders core nav
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped: Record<string, PageDefinition[]> = {};
  for (const page of pages) {
    const group = page.navGroup || 'custom';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(page);
  }

  return { grouped, loading };
}
