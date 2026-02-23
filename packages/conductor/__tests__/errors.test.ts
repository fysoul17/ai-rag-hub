import { describe, expect, test } from 'bun:test';
import {
  ConductorError,
  ConductorNotInitializedError,
  DelegationError,
} from '../src/errors.ts';

describe('ConductorError', () => {
  test('is an instance of Error', () => {
    const err = new ConductorError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConductorError);
  });

  test('has correct name and message', () => {
    const err = new ConductorError('something failed');
    expect(err.name).toBe('ConductorError');
    expect(err.message).toBe('something failed');
  });
});

describe('ConductorNotInitializedError', () => {
  test('extends ConductorError', () => {
    const err = new ConductorNotInitializedError();
    expect(err).toBeInstanceOf(ConductorError);
    expect(err).toBeInstanceOf(Error);
  });

  test('has correct name and message', () => {
    const err = new ConductorNotInitializedError();
    expect(err.name).toBe('ConductorNotInitializedError');
    expect(err.message).toContain('not initialized');
  });
});

describe('DelegationError', () => {
  test('extends ConductorError', () => {
    const err = new DelegationError('agent-1', 'timeout');
    expect(err).toBeInstanceOf(ConductorError);
  });

  test('includes agentId and detail in message', () => {
    const err = new DelegationError('agent-1', 'process not responding');
    expect(err.name).toBe('DelegationError');
    expect(err.message).toContain('agent-1');
    expect(err.message).toContain('process not responding');
  });
});
