import { beforeEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { PageStore } from '@autonomy/control-plane';
import { BadRequestError, NotFoundError } from '../../src/errors.ts';
import { createPageRoutes } from '../../src/routes/pages.ts';

describe('Page routes', () => {
  let db: Database;
  let pageStore: PageStore;
  let routes: ReturnType<typeof createPageRoutes>;

  beforeEach(() => {
    db = new Database(':memory:');
    pageStore = new PageStore(db);
    routes = createPageRoutes(pageStore);
  });

  describe('GET /api/pages (list)', () => {
    test('returns empty list', async () => {
      const req = new Request('http://localhost/api/pages');
      const res = await routes.list(req);
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    test('returns all pages', async () => {
      pageStore.save('p1', { slug: 'page-a', title: 'Page A' });
      pageStore.save('p2', { slug: 'page-b', title: 'Page B' });

      const req = new Request('http://localhost/api/pages');
      const res = await routes.list(req);
      const body = await res.json();

      expect(body.data).toHaveLength(2);
    });

    test('filters by status query param', async () => {
      pageStore.save('p1', { slug: 'active-page', title: 'Active' });
      pageStore.save('p2', { slug: 'disabled-page', title: 'Disabled' });
      pageStore.update('p2', { status: 'disabled' });

      const req = new Request('http://localhost/api/pages?status=active');
      const res = await routes.list(req);
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe('active-page');
    });
  });

  describe('POST /api/pages (create)', () => {
    test('creates a page', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'test-page', title: 'Test Page' }),
      });
      const res = await routes.create(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('test-page');
      expect(body.data.title).toBe('Test Page');
      expect(body.data.status).toBe('active');
    });

    test('rejects missing slug', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ title: 'No Slug' }),
      });
      await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
    });

    test('rejects missing title', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'no-title' }),
      });
      await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
    });

    test('rejects invalid slug format', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'UPPERCASE', title: 'Bad' }),
      });
      await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
    });

    test('rejects slug with special characters', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'page_with_underscores', title: 'Bad' }),
      });
      await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
    });

    test('rejects protected slugs', async () => {
      for (const slug of ['agents', 'chat', 'settings', 'login', 'memory']) {
        const req = new Request('http://localhost/api/pages', {
          method: 'POST',
          body: JSON.stringify({ slug, title: `Protected: ${slug}` }),
        });
        await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
      }
    });

    test('rejects duplicate slug', async () => {
      pageStore.save('p1', { slug: 'taken', title: 'First' });

      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'taken', title: 'Second' }),
      });
      await expect(routes.create(req)).rejects.toBeInstanceOf(BadRequestError);
    });

    test('allows nested slug', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'reports/daily', title: 'Daily Reports' }),
      });
      const res = await routes.create(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.slug).toBe('reports/daily');
      expect(body.data.filePath).toBe('app/(dashboard)/x/reports/daily/page.tsx');
    });

    test('sets filePath correctly', async () => {
      const req = new Request('http://localhost/api/pages', {
        method: 'POST',
        body: JSON.stringify({ slug: 'my-page', title: 'My Page' }),
      });
      const res = await routes.create(req);
      const body = await res.json();

      expect(body.data.filePath).toBe('app/(dashboard)/x/my-page/page.tsx');
    });
  });

  describe('GET /api/pages/:id (get)', () => {
    test('returns a page by id', async () => {
      pageStore.save('p1', { slug: 'test', title: 'Test' });

      const req = new Request('http://localhost/api/pages/p1');
      const res = await routes.get(req, { id: 'p1' });
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Test');
    });

    test('throws NotFoundError for missing page', async () => {
      const req = new Request('http://localhost/api/pages/nope');
      await expect(routes.get(req, { id: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
    });

    test('throws BadRequestError when id is missing', async () => {
      const req = new Request('http://localhost/api/pages/');
      await expect(routes.get(req, {})).rejects.toBeInstanceOf(BadRequestError);
    });
  });

  describe('PUT /api/pages/:id (update)', () => {
    test('updates page fields', async () => {
      pageStore.save('p1', { slug: 'test', title: 'Original' });

      const req = new Request('http://localhost/api/pages/p1', {
        method: 'PUT',
        body: JSON.stringify({ title: 'Updated', icon: 'Brain' }),
      });
      const res = await routes.update(req, { id: 'p1' });
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.title).toBe('Updated');
      expect(body.data.icon).toBe('Brain');
    });

    test('throws NotFoundError for missing page', async () => {
      const req = new Request('http://localhost/api/pages/nope', {
        method: 'PUT',
        body: JSON.stringify({ title: 'X' }),
      });
      await expect(routes.update(req, { id: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('DELETE /api/pages/:id (remove)', () => {
    test('deletes a page', async () => {
      pageStore.save('p1', { slug: 'test', title: 'Test' });

      const req = new Request('http://localhost/api/pages/p1', { method: 'DELETE' });
      const res = await routes.remove(req, { id: 'p1' });
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.data.deleted).toBe('p1');
      expect(pageStore.getById('p1')).toBeNull();
    });

    test('throws NotFoundError for missing page', async () => {
      const req = new Request('http://localhost/api/pages/nope', { method: 'DELETE' });
      await expect(routes.remove(req, { id: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
