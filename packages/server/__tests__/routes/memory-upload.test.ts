import { beforeEach, describe, expect, test } from 'bun:test';
import type { Memory } from '@pyx-memory/core';
import { BadRequestError } from '../../src/errors.ts';
import { createMemoryRoutes } from '../../src/routes/memory.ts';

interface MockStoreInput {
  content: string;
  type: string;
  metadata: Record<string, unknown>;
}

class MockMemory {
  storeCalls: MockStoreInput[] = [];

  async store(entry: MockStoreInput) {
    this.storeCalls.push(entry);
    return {
      id: `mem-${this.storeCalls.length}`,
      content: entry.content,
      type: entry.type,
      metadata: entry.metadata ?? {},
      createdAt: new Date().toISOString(),
    };
  }

  async search() {
    return { entries: [], totalCount: 0, strategy: 'naive' };
  }

  async stats() {
    return { totalEntries: 0, storageUsedBytes: 0, vectorCount: 0, recentAccessCount: 0 };
  }
}

function makeFileRequest(filename: string, content: string, contentType?: string): Request {
  const formData = new FormData();
  const blob = new Blob([content], { type: contentType ?? 'text/plain' });
  formData.append('file', new File([blob], filename));

  return new Request('http://localhost/api/memory/ingest/file', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/memory/ingest/file', () => {
  let memory: MockMemory;
  let routes: ReturnType<typeof createMemoryRoutes>;

  beforeEach(() => {
    memory = new MockMemory();
    routes = createMemoryRoutes(memory as unknown as Memory);
  });

  test('ingests a valid .txt file', async () => {
    const req = makeFileRequest('test.txt', 'Hello world, this is test content.');
    const res = await routes.ingestFile(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.filename).toBe('test.txt');
    expect(body.data.chunks).toBeGreaterThanOrEqual(1);
    expect(body.data.totalCharacters).toBeGreaterThan(0);
  });

  test('ingests a valid .md file', async () => {
    const req = makeFileRequest('readme.md', '# Title\n\nSome markdown content.');
    const res = await routes.ingestFile(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.filename).toBe('readme.md');
    expect(body.data.chunks).toBeGreaterThanOrEqual(1);
  });

  test('ingests a valid .csv file', async () => {
    const req = makeFileRequest('data.csv', 'name,value\nalice,1\nbob,2');
    const res = await routes.ingestFile(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.filename).toBe('data.csv');
  });

  test('rejects unsupported file type', async () => {
    const req = makeFileRequest('malware.exe', 'binary content');
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  test('rejects empty file', async () => {
    const req = makeFileRequest('empty.txt', '');
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  test('rejects missing file field', async () => {
    const formData = new FormData();
    formData.append('notfile', 'oops');
    const req = new Request('http://localhost/api/memory/ingest/file', {
      method: 'POST',
      body: formData,
    });
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  test('rejects non-multipart request', async () => {
    const req = new Request('http://localhost/api/memory/ingest/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'nope' }),
    });
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  test('stores chunks in memory with source metadata', async () => {
    const req = makeFileRequest('notes.txt', 'Some content to be chunked and stored.');
    await routes.ingestFile(req);

    expect(memory.storeCalls.length).toBeGreaterThanOrEqual(1);
    expect(memory.storeCalls[0].metadata.source).toBe('notes.txt');
  });

  test('rejects file with no extension', async () => {
    const req = makeFileRequest('Makefile', 'all: build');
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  test('handles double extension correctly', async () => {
    // file.tar.gz → extracts .gz which is not in supported extensions
    const req = makeFileRequest('archive.tar.gz', 'fake gzip content');
    await expect(routes.ingestFile(req)).rejects.toBeInstanceOf(BadRequestError);
  });
});
