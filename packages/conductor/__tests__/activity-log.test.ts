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

  test('getByAgent filters by agentId', () => {
    const log = new ActivityLog();
    log.record(ActivityType.DELEGATION, 'to agent-1', 'agent-1');
    log.record(ActivityType.DELEGATION, 'to agent-2', 'agent-2');
    log.record(ActivityType.DELEGATION, 'to agent-1 again', 'agent-1');

    const agent1 = log.getByAgent('agent-1');
    expect(agent1.length).toBe(2);
    expect(agent1[0].details).toBe('to agent-1 again');
    expect(agent1[1].details).toBe('to agent-1');
  });

  test('getByAgent respects limit', () => {
    const log = new ActivityLog();
    log.record(ActivityType.DELEGATION, 'first', 'agent-1');
    log.record(ActivityType.DELEGATION, 'second', 'agent-1');
    log.record(ActivityType.DELEGATION, 'third', 'agent-1');

    const result = log.getByAgent('agent-1', 1);
    expect(result.length).toBe(1);
    expect(result[0].details).toBe('third');
  });

  test('getByType filters by type', () => {
    const log = new ActivityLog();
    log.record(ActivityType.MESSAGE, 'msg');
    log.record(ActivityType.ERROR, 'err');
    log.record(ActivityType.MESSAGE, 'msg2');

    const messages = log.getByType(ActivityType.MESSAGE);
    expect(messages.length).toBe(2);

    const errors = log.getByType(ActivityType.ERROR);
    expect(errors.length).toBe(1);
    expect(errors[0].details).toBe('err');
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
