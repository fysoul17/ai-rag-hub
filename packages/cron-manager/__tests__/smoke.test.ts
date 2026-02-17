import { describe, expect, test } from 'bun:test';
import {
  CronManager,
  CronManagerError,
  CronNotFoundError,
  CronNotInitializedError,
  CronScheduleError,
} from '../src/index.ts';

describe('cron-manager exports', () => {
  test('CronManager is exported', () => {
    expect(CronManager).toBeDefined();
    expect(typeof CronManager).toBe('function');
  });

  test('CronManagerError is exported', () => {
    expect(CronManagerError).toBeDefined();
    const err = new CronManagerError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('CronManagerError');
  });

  test('CronNotFoundError is exported', () => {
    expect(CronNotFoundError).toBeDefined();
    const err = new CronNotFoundError('cron-1');
    expect(err).toBeInstanceOf(CronManagerError);
    expect(err.name).toBe('CronNotFoundError');
    expect(err.message).toContain('cron-1');
  });

  test('CronNotInitializedError is exported', () => {
    expect(CronNotInitializedError).toBeDefined();
    const err = new CronNotInitializedError();
    expect(err).toBeInstanceOf(CronManagerError);
    expect(err.name).toBe('CronNotInitializedError');
  });

  test('CronScheduleError is exported', () => {
    expect(CronScheduleError).toBeDefined();
    const err = new CronScheduleError('bad', 'invalid');
    expect(err).toBeInstanceOf(CronManagerError);
    expect(err.name).toBe('CronScheduleError');
    expect(err.message).toContain('bad');
  });
});
