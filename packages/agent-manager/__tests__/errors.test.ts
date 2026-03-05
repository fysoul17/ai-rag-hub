import { describe, expect, test } from 'bun:test';
import {
  AgentManagerError,
  AgentNotFoundError,
  AgentStateError,
  BackendError,
  MaxAgentsReachedError,
} from '../src/errors.ts';

describe('AgentManagerError', () => {
  test('is an instance of Error', () => {
    const err = new AgentManagerError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AgentManagerError);
  });

  test('has correct name and message', () => {
    const err = new AgentManagerError('something failed');
    expect(err.name).toBe('AgentManagerError');
    expect(err.message).toBe('something failed');
  });
});

describe('AgentNotFoundError', () => {
  test('extends AgentManagerError', () => {
    const err = new AgentNotFoundError('agent-42');
    expect(err).toBeInstanceOf(AgentManagerError);
    expect(err).toBeInstanceOf(Error);
  });

  test('has correct name and includes agentId in message', () => {
    const err = new AgentNotFoundError('agent-42');
    expect(err.name).toBe('AgentNotFoundError');
    expect(err.message).toContain('agent-42');
    expect(err.message).toContain('not found');
  });
});

describe('MaxAgentsReachedError', () => {
  test('extends AgentManagerError', () => {
    const err = new MaxAgentsReachedError(10);
    expect(err).toBeInstanceOf(AgentManagerError);
  });

  test('has correct name and includes max count', () => {
    const err = new MaxAgentsReachedError(5);
    expect(err.name).toBe('MaxAgentsReachedError');
    expect(err.message).toContain('5');
  });
});

describe('AgentStateError', () => {
  test('extends AgentManagerError', () => {
    const err = new AgentStateError('agent-1', 'stopped', 'resume');
    expect(err).toBeInstanceOf(AgentManagerError);
  });

  test('includes agentId, status, and action in message', () => {
    const err = new AgentStateError('agent-1', 'stopped', 'resume');
    expect(err.name).toBe('AgentStateError');
    expect(err.message).toContain('agent-1');
    expect(err.message).toContain('stopped');
    expect(err.message).toContain('resume');
  });
});

describe('BackendError', () => {
  test('extends AgentManagerError', () => {
    const err = new BackendError('claude', 'spawn failed');
    expect(err).toBeInstanceOf(AgentManagerError);
  });

  test('includes backend name and detail in message', () => {
    const err = new BackendError('claude', 'process exited unexpectedly');
    expect(err.name).toBe('BackendError');
    expect(err.message).toContain('claude');
    expect(err.message).toContain('process exited unexpectedly');
  });
});
