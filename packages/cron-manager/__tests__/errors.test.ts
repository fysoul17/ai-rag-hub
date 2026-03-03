import { describe, expect, test } from 'bun:test';
import {
  CronManagerError,
  CronNotFoundError,
  CronNotInitializedError,
  CronScheduleError,
} from '../src/errors.ts';

describe('CronManagerError', () => {
  test('is an instance of Error', () => {
    const err = new CronManagerError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CronManagerError);
  });

  test('has correct name and message', () => {
    const err = new CronManagerError('cron failed');
    expect(err.name).toBe('CronManagerError');
    expect(err.message).toBe('cron failed');
  });
});

describe('CronNotFoundError', () => {
  test('extends CronManagerError', () => {
    const err = new CronNotFoundError('cron-42');
    expect(err).toBeInstanceOf(CronManagerError);
    expect(err).toBeInstanceOf(Error);
  });

  test('has correct name and includes cronId in message', () => {
    const err = new CronNotFoundError('cron-42');
    expect(err.name).toBe('CronNotFoundError');
    expect(err.message).toContain('cron-42');
    expect(err.message).toContain('not found');
  });
});

describe('CronNotInitializedError', () => {
  test('extends CronManagerError', () => {
    const err = new CronNotInitializedError();
    expect(err).toBeInstanceOf(CronManagerError);
  });

  test('has correct name and message', () => {
    const err = new CronNotInitializedError();
    expect(err.name).toBe('CronNotInitializedError');
    expect(err.message).toContain('not initialized');
  });
});

describe('CronScheduleError', () => {
  test('extends CronManagerError', () => {
    const err = new CronScheduleError('* * *', 'too few fields');
    expect(err).toBeInstanceOf(CronManagerError);
  });

  test('includes schedule and detail in message', () => {
    const err = new CronScheduleError('*/5 * * *', 'invalid syntax');
    expect(err.name).toBe('CronScheduleError');
    expect(err.message).toContain('*/5 * * *');
    expect(err.message).toContain('invalid syntax');
  });
});
