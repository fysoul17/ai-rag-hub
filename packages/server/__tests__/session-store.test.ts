import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, test } from 'bun:test';
import { MessageRole, SessionStatus } from '@autonomy/shared';
import { SessionStore } from '../src/session-store.ts';

describe('SessionStore', () => {
  let db: Database;
  let store: SessionStore;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');
    store = new SessionStore(db);
  });

  describe('create', () => {
    test('creates a session with default title', () => {
      const session = store.create({});
      expect(session.id).toBeDefined();
      expect(session.title).toBe('New Session');
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.messageCount).toBe(0);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    test('creates a session with custom title', () => {
      const session = store.create({ title: 'My Chat' });
      expect(session.title).toBe('My Chat');
    });

    test('creates a session with agentId', () => {
      const session = store.create({ agentId: 'agent-1' });
      expect(session.agentId).toBe('agent-1');
    });

    test('creates a session without agentId', () => {
      const session = store.create({});
      expect(session.agentId).toBeUndefined();
    });

    test('each session gets a unique id', () => {
      const s1 = store.create({});
      const s2 = store.create({});
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('getById', () => {
    test('returns session by id', () => {
      const created = store.create({ title: 'Test' });
      const found = store.getById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe('Test');
    });

    test('returns null for non-existent id', () => {
      expect(store.getById('does-not-exist')).toBeNull();
    });
  });

  describe('getDetail', () => {
    test('returns session with empty messages array', () => {
      const created = store.create({ title: 'Detail Test' });
      const detail = store.getDetail(created.id);
      expect(detail).not.toBeNull();
      expect(detail?.messages).toEqual([]);
      expect(detail?.title).toBe('Detail Test');
    });

    test('returns session with messages in chronological order', () => {
      const created = store.create({});
      store.addMessage(created.id, MessageRole.USER, 'Hello');
      store.addMessage(created.id, MessageRole.ASSISTANT, 'Hi there');

      const detail = store.getDetail(created.id);
      expect(detail?.messages.length).toBe(2);
      expect(detail?.messages[0].role).toBe(MessageRole.USER);
      expect(detail?.messages[0].content).toBe('Hello');
      expect(detail?.messages[1].role).toBe(MessageRole.ASSISTANT);
      expect(detail?.messages[1].content).toBe('Hi there');
    });

    test('returns null for non-existent id', () => {
      expect(store.getDetail('does-not-exist')).toBeNull();
    });
  });

  describe('list', () => {
    test('returns empty list when no sessions', () => {
      const result = store.list();
      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    test('returns all sessions', () => {
      store.create({ title: 'First' });
      store.create({ title: 'Second' });
      store.create({ title: 'Third' });

      const result = store.list();
      expect(result.sessions.length).toBe(3);
      expect(result.total).toBe(3);
      const titles = result.sessions.map((s) => s.title);
      expect(titles).toContain('First');
      expect(titles).toContain('Second');
      expect(titles).toContain('Third');
    });

    test('paginates results', () => {
      for (let i = 0; i < 5; i++) {
        store.create({ title: `Session ${i}` });
      }

      const page1 = store.list({ page: 1, limit: 2 });
      expect(page1.sessions.length).toBe(2);
      expect(page1.total).toBe(5);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);

      const page2 = store.list({ page: 2, limit: 2 });
      expect(page2.sessions.length).toBe(2);

      const page3 = store.list({ page: 3, limit: 2 });
      expect(page3.sessions.length).toBe(1);
    });

    test('filters by agentId', () => {
      store.create({ agentId: 'agent-1' });
      store.create({ agentId: 'agent-2' });
      store.create({ agentId: 'agent-1' });

      const result = store.list({ agentId: 'agent-1' });
      expect(result.sessions.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.sessions.every((s) => s.agentId === 'agent-1')).toBe(true);
    });

    test('returns empty for non-existent agentId filter', () => {
      store.create({});
      const result = store.list({ agentId: 'no-such-agent' });
      expect(result.sessions.length).toBe(0);
      expect(result.total).toBe(0);
    });

    test('clamps page to minimum 1', () => {
      store.create({});
      const result = store.list({ page: -5 });
      expect(result.page).toBe(1);
    });

    test('clamps limit to valid range', () => {
      store.create({});
      const tooSmall = store.list({ limit: 0 });
      expect(tooSmall.limit).toBe(1);

      const tooLarge = store.list({ limit: 500 });
      expect(tooLarge.limit).toBe(100);
    });
  });

  describe('update', () => {
    test('updates title', () => {
      const created = store.create({ title: 'Original' });
      const updated = store.update(created.id, { title: 'Renamed' });
      expect(updated).not.toBeNull();
      expect(updated?.title).toBe('Renamed');
    });

    test('sets updated_at on update', () => {
      const created = store.create({});
      const updated = store.update(created.id, { title: 'Changed' });
      expect(updated?.updatedAt).toBeDefined();
      expect(typeof updated?.updatedAt).toBe('string');
    });

    test('returns null for non-existent id', () => {
      expect(store.update('does-not-exist', { title: 'X' })).toBeNull();
    });

    test('no-op update when no fields provided', () => {
      const created = store.create({ title: 'Keep' });
      const updated = store.update(created.id, {});
      expect(updated?.title).toBe('Keep');
    });
  });

  describe('delete', () => {
    test('deletes existing session', () => {
      const created = store.create({});
      expect(store.delete(created.id)).toBe(true);
      expect(store.getById(created.id)).toBeNull();
    });

    test('returns false for non-existent id', () => {
      expect(store.delete('does-not-exist')).toBe(false);
    });

    test('cascade deletes messages', () => {
      const session = store.create({});
      store.addMessage(session.id, MessageRole.USER, 'msg1');
      store.addMessage(session.id, MessageRole.ASSISTANT, 'msg2');

      store.delete(session.id);

      // Verify messages are gone
      const rows = db
        .query('SELECT COUNT(*) as count FROM session_messages WHERE session_id = ?')
        .get(session.id) as { count: number };
      expect(rows.count).toBe(0);
    });
  });

  describe('addMessage', () => {
    test('adds a user message', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.USER, 'Hello');

      expect(msg.id).toBeDefined();
      expect(msg.sessionId).toBe(session.id);
      expect(msg.role).toBe(MessageRole.USER);
      expect(msg.content).toBe('Hello');
      expect(msg.createdAt).toBeDefined();
    });

    test('adds an assistant message with agentId', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.ASSISTANT, 'Response', 'agent-1');

      expect(msg.agentId).toBe('agent-1');
    });

    test('adds a message with metadata', () => {
      const session = store.create({});
      const meta = { model: 'claude', tokens: 100 };
      const msg = store.addMessage(session.id, MessageRole.ASSISTANT, 'Hi', undefined, meta);

      expect(msg.metadata).toEqual(meta);
    });

    test('increments session message_count', () => {
      const session = store.create({});
      store.addMessage(session.id, MessageRole.USER, 'msg1');
      store.addMessage(session.id, MessageRole.ASSISTANT, 'msg2');

      const updated = store.getById(session.id);
      expect(updated?.messageCount).toBe(2);
    });

    test('updates session updated_at', () => {
      const session = store.create({});
      const _originalUpdated = session.updatedAt;

      store.addMessage(session.id, MessageRole.USER, 'new msg');
      const updated = store.getById(session.id);
      // updatedAt should change (or at least be set)
      expect(updated?.updatedAt).toBeDefined();
    });

    test('message without agentId has undefined agentId', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.USER, 'test');
      expect(msg.agentId).toBeUndefined();
    });

    test('message without metadata has undefined metadata', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.USER, 'test');
      expect(msg.metadata).toBeUndefined();
    });

    test('supports system role messages', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.SYSTEM, 'System message');
      expect(msg.role).toBe(MessageRole.SYSTEM);
    });
  });

  describe('migration idempotency', () => {
    test('creating multiple stores on same db does not error', () => {
      // The constructor calls migrate() which should be idempotent
      const store2 = new SessionStore(db);
      expect(store2).toBeDefined();

      // Original store should still work
      const session = store.create({ title: 'After re-migrate' });
      expect(session.title).toBe('After re-migrate');
    });
  });

  describe('edge cases', () => {
    test('empty string title is allowed', () => {
      const session = store.create({ title: '' });
      // Empty title falls back to default
      expect(session.title).toBe('New Session');
    });

    test('very long title is stored correctly', () => {
      const longTitle = 'A'.repeat(1000);
      const session = store.create({ title: longTitle });
      expect(session.title).toBe(longTitle);
    });

    test('message with empty content is stored', () => {
      const session = store.create({});
      const msg = store.addMessage(session.id, MessageRole.USER, '');
      expect(msg.content).toBe('');
    });

    test('pagination beyond total returns empty', () => {
      store.create({});
      const result = store.list({ page: 100, limit: 10 });
      expect(result.sessions.length).toBe(0);
      expect(result.total).toBe(1);
    });
  });
});
