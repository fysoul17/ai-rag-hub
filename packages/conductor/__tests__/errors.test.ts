import { describe, expect, test } from 'bun:test';
import {
  ApprovalRequiredError,
  ConductorError,
  ConductorNotInitializedError,
  DelegationError,
  PermissionDeniedError,
  RoutingError,
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

describe('PermissionDeniedError', () => {
  test('extends ConductorError', () => {
    const err = new PermissionDeniedError('delete', 'self', 'system-protected');
    expect(err).toBeInstanceOf(ConductorError);
  });

  test('includes action, target, and reason in message', () => {
    const err = new PermissionDeniedError('delete', 'self', 'system-protected');
    expect(err.name).toBe('PermissionDeniedError');
    expect(err.message).toContain('delete');
    expect(err.message).toContain('self');
    expect(err.message).toContain('system-protected');
  });
});

describe('ApprovalRequiredError', () => {
  test('extends ConductorError', () => {
    const err = new ApprovalRequiredError('modify', 'user-agent');
    expect(err).toBeInstanceOf(ConductorError);
  });

  test('includes action and target in message', () => {
    const err = new ApprovalRequiredError('modify', 'user-agent');
    expect(err.name).toBe('ApprovalRequiredError');
    expect(err.message).toContain('modify');
    expect(err.message).toContain('user-agent');
    expect(err.message).toContain('approval');
  });
});

describe('RoutingError', () => {
  test('extends ConductorError', () => {
    const err = new RoutingError('no agents available');
    expect(err).toBeInstanceOf(ConductorError);
  });

  test('includes detail in message', () => {
    const err = new RoutingError('no agents available');
    expect(err.name).toBe('RoutingError');
    expect(err.message).toContain('no agents available');
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
