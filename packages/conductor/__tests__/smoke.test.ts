import { describe, expect, test } from 'bun:test';
import {
  ActivityLog,
  Conductor,
  ConductorError,
  ConductorNotInitializedError,
  DelegationError,
} from '../src/index.ts';

describe('conductor smoke tests', () => {
  test('package is importable', () => {
    expect(Conductor).toBeDefined();
  });

  test('all error classes are exported', () => {
    expect(ConductorError).toBeDefined();
    expect(ConductorNotInitializedError).toBeDefined();
    expect(DelegationError).toBeDefined();
  });

  test('ActivityLog is exported and instantiable', () => {
    const log = new ActivityLog();
    expect(log).toBeDefined();
    expect(log.size).toBe(0);
  });
});
