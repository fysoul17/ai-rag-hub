import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { PageStore } from '../src/page-store.ts';

describe('PageStore', () => {
  let db: Database;
  let store: PageStore;

  beforeEach(() => {
    db = new Database(':memory:');
    store = new PageStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('save()', () => {
    test('saves a page with defaults', () => {
      const page = store.save('p1', { slug: 'test-page', title: 'Test Page' });

      expect(page.id).toBe('p1');
      expect(page.slug).toBe('test-page');
      expect(page.title).toBe('Test Page');
      expect(page.description).toBe('');
      expect(page.icon).toBe('FileText');
      expect(page.navGroup).toBe('custom');
      expect(page.navOrder).toBe(0);
      expect(page.agentId).toBeNull();
      expect(page.status).toBe('active');
      expect(page.filePath).toBe('app/(dashboard)/x/test-page/page.tsx');
      expect(page.metadata).toEqual({});
    });

    test('saves with all fields specified', () => {
      const page = store.save('p2', {
        slug: 'reports/daily',
        title: 'Daily Reports',
        description: 'Generated daily reports',
        icon: 'BarChart3',
        navGroup: 'tools',
        navOrder: 5,
        agentId: 'agent-1',
        metadata: { theme: 'dark' },
      });

      expect(page.slug).toBe('reports/daily');
      expect(page.description).toBe('Generated daily reports');
      expect(page.icon).toBe('BarChart3');
      expect(page.navGroup).toBe('tools');
      expect(page.navOrder).toBe(5);
      expect(page.agentId).toBe('agent-1');
      expect(page.filePath).toBe('app/(dashboard)/x/reports/daily/page.tsx');
      expect(page.metadata).toEqual({ theme: 'dark' });
    });

    test('enforces unique slug constraint', () => {
      store.save('p1', { slug: 'unique', title: 'First' });
      expect(() => store.save('p2', { slug: 'unique', title: 'Second' })).toThrow();
    });
  });

  describe('getById()', () => {
    test('returns null for non-existent page', () => {
      expect(store.getById('nope')).toBeNull();
    });

    test('returns the correct page', () => {
      store.save('p1', { slug: 'a', title: 'Page A' });
      store.save('p2', { slug: 'b', title: 'Page B' });

      const found = store.getById('p1');
      expect(found?.title).toBe('Page A');
    });
  });

  describe('getBySlug()', () => {
    test('returns null for non-existent slug', () => {
      expect(store.getBySlug('nope')).toBeNull();
    });

    test('finds page by slug', () => {
      store.save('p1', { slug: 'my-page', title: 'My Page' });

      const found = store.getBySlug('my-page');
      expect(found?.id).toBe('p1');
      expect(found?.title).toBe('My Page');
    });
  });

  describe('update()', () => {
    test('updates specified fields', () => {
      store.save('p1', { slug: 'test', title: 'Original' });

      const updated = store.update('p1', { title: 'Updated', icon: 'Brain' });
      expect(updated?.title).toBe('Updated');
      expect(updated?.icon).toBe('Brain');
      // Unchanged fields preserved
      expect(updated?.slug).toBe('test');
      expect(updated?.navGroup).toBe('custom');
    });

    test('returns null for non-existent page', () => {
      const result = store.update('ghost', { title: 'New' });
      expect(result).toBeNull();
    });

    test('updates status', () => {
      store.save('p1', { slug: 'test', title: 'Test' });

      const updated = store.update('p1', { status: 'disabled' });
      expect(updated?.status).toBe('disabled');
    });

    test('updates metadata', () => {
      store.save('p1', { slug: 'test', title: 'Test', metadata: { a: 1 } });

      const updated = store.update('p1', { metadata: { b: 2 } });
      expect(updated?.metadata).toEqual({ b: 2 });
    });
  });

  describe('delete()', () => {
    test('deletes an existing page', () => {
      store.save('p1', { slug: 'test', title: 'Test' });
      expect(store.getById('p1')).not.toBeNull();

      const result = store.delete('p1');
      expect(result).toBe(true);
      expect(store.getById('p1')).toBeNull();
    });

    test('returns false for non-existent page', () => {
      expect(store.delete('ghost')).toBe(false);
    });
  });

  describe('list()', () => {
    test('returns empty array when no pages', () => {
      expect(store.list()).toEqual([]);
    });

    test('returns all pages sorted by nav_group, nav_order', () => {
      store.save('p1', { slug: 'b', title: 'B', navGroup: 'tools', navOrder: 2 });
      store.save('p2', { slug: 'a', title: 'A', navGroup: 'custom', navOrder: 1 });
      store.save('p3', { slug: 'c', title: 'C', navGroup: 'tools', navOrder: 1 });

      const pages = store.list();
      expect(pages).toHaveLength(3);
      // custom comes before tools alphabetically
      expect(pages[0].slug).toBe('a');
      // tools sorted by nav_order
      expect(pages[1].slug).toBe('c');
      expect(pages[2].slug).toBe('b');
    });

    test('filters by status', () => {
      store.save('p1', { slug: 'active-page', title: 'Active' });
      store.save('p2', { slug: 'disabled-page', title: 'Disabled' });
      store.update('p2', { status: 'disabled' });

      const active = store.list({ status: 'active' });
      expect(active).toHaveLength(1);
      expect(active[0].slug).toBe('active-page');
    });
  });
});
