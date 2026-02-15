import { describe, expect, test } from 'bun:test';
import {
  EmbeddingError,
  MemoryError,
  MemoryNotFoundError,
  MemorySearchError,
  MemoryStoreError,
  VectorProviderError,
} from '../src/errors.ts';

describe('Memory errors', () => {
  describe('MemoryError', () => {
    test('extends Error', () => {
      const err = new MemoryError('test error');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(MemoryError);
    });

    test('has correct name', () => {
      const err = new MemoryError('test');
      expect(err.name).toBe('MemoryError');
    });

    test('preserves message', () => {
      const err = new MemoryError('something went wrong');
      expect(err.message).toBe('something went wrong');
    });
  });

  describe('MemoryStoreError', () => {
    test('extends MemoryError', () => {
      const err = new MemoryStoreError('insert', 'duplicate key');
      expect(err).toBeInstanceOf(MemoryError);
      expect(err).toBeInstanceOf(Error);
    });

    test('has correct name', () => {
      const err = new MemoryStoreError('insert', 'failed');
      expect(err.name).toBe('MemoryStoreError');
    });

    test('includes operation and detail in message', () => {
      const err = new MemoryStoreError('insert', 'unique constraint');
      expect(err.message).toContain('insert');
      expect(err.message).toContain('unique constraint');
    });

    test('instanceof checks work through hierarchy', () => {
      const err = new MemoryStoreError('update', 'test');
      expect(err instanceof MemoryStoreError).toBe(true);
      expect(err instanceof MemoryError).toBe(true);
      expect(err instanceof Error).toBe(true);
    });
  });

  describe('MemoryNotFoundError', () => {
    test('extends MemoryError', () => {
      const err = new MemoryNotFoundError('abc-123');
      expect(err).toBeInstanceOf(MemoryError);
    });

    test('includes id in message', () => {
      const err = new MemoryNotFoundError('entry-42');
      expect(err.message).toContain('entry-42');
    });

    test('has correct name', () => {
      const err = new MemoryNotFoundError('id');
      expect(err.name).toBe('MemoryNotFoundError');
    });
  });

  describe('MemorySearchError', () => {
    test('extends MemoryError', () => {
      const err = new MemorySearchError('query failed');
      expect(err).toBeInstanceOf(MemoryError);
      expect(err).toBeInstanceOf(Error);
    });

    test('has correct name', () => {
      const err = new MemorySearchError('test');
      expect(err.name).toBe('MemorySearchError');
    });
  });

  describe('VectorProviderError', () => {
    test('extends MemoryError', () => {
      const err = new VectorProviderError('lancedb', 'connection failed');
      expect(err).toBeInstanceOf(MemoryError);
      expect(err).toBeInstanceOf(Error);
    });

    test('has correct name', () => {
      const err = new VectorProviderError('lancedb', 'test');
      expect(err.name).toBe('VectorProviderError');
    });

    test('includes provider name and detail in message', () => {
      const err = new VectorProviderError('lancedb', 'timeout');
      expect(err.message).toContain('lancedb');
      expect(err.message).toContain('timeout');
    });
  });

  describe('EmbeddingError', () => {
    test('extends MemoryError', () => {
      const err = new EmbeddingError('model not found');
      expect(err).toBeInstanceOf(MemoryError);
    });

    test('has correct name', () => {
      const err = new EmbeddingError('test');
      expect(err.name).toBe('EmbeddingError');
    });
  });
});
