import { describe, expect, test } from 'bun:test';
import { ActivityType } from '@autonomy/shared';
import { ActivityLog } from '../src/activity-log.ts';

describe('ActivityLog', () => {
  test('starts empty', () => {
    const log = new ActivityLog();
    expect(log.size).toBe(0);
    expect(log.getRecent()).toEqual([]);
  });

  test('records entries with generated id and timestamp', () => {
    const log = new ActivityLog();
    const entry = log.record(ActivityType.MESSAGE, 'test message');
    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.type).toBe(ActivityType.MESSAGE);
    expect(entry.details).toBe('test message');
    expect(log.size).toBe(1);
  });

  test('records entries with optional agentId and metadata', () => {
    const log = new ActivityLog();
    const entry = log.record(ActivityType.DELEGATION, 'delegated', 'agent-1', { key: 'val' });
    expect(entry.agentId).toBe('agent-1');
    expect(entry.metadata).toEqual({ key: 'val' });
  });

  test('getRecent returns entries in reverse chronological order', () => {
    const log = new ActivityLog();
    log.record(ActivityType.MESSAGE, 'first');
    log.record(ActivityType.MESSAGE, 'second');
    log.record(ActivityType.MESSAGE, 'third');

    const recent = log.getRecent();
    expect(recent[0].details).toBe('third');
    expect(recent[1].details).toBe('second');
    expect(recent[2].details).toBe('first');
  });

  test('getRecent respects limit', () => {
    const log = new ActivityLog();
    log.record(ActivityType.MESSAGE, 'first');
    log.record(ActivityType.MESSAGE, 'second');
    log.record(ActivityType.MESSAGE, 'third');

    const recent = log.getRecent(2);
    expect(recent.length).toBe(2);
    expect(recent[0].details).toBe('third');
    expect(recent[1].details).toBe('second');
  });

  test('ring buffer discards oldest entries when exceeding max size', () => {
    const log = new ActivityLog(3);
    log.record(ActivityType.MESSAGE, 'a');
    log.record(ActivityType.MESSAGE, 'b');
    log.record(ActivityType.MESSAGE, 'c');
    log.record(ActivityType.MESSAGE, 'd');

    expect(log.size).toBe(3);
    const recent = log.getRecent();
    expect(recent[0].details).toBe('d');
    expect(recent[1].details).toBe('c');
    expect(recent[2].details).toBe('b');
  });

  test('clear removes all entries', () => {
    const log = new ActivityLog();
    log.record(ActivityType.MESSAGE, 'a');
    log.record(ActivityType.MESSAGE, 'b');
    expect(log.size).toBe(2);

    log.clear();
    expect(log.size).toBe(0);
    expect(log.getRecent()).toEqual([]);
  });
});
