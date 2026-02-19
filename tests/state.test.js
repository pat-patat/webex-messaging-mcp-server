import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createStateManager } from '../lib/state.js';

describe('State Manager', () => {
  let tmpDir;
  let statePath;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'webex-mcp-state-test-'));
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getLastChecked', () => {
    it('should return null for unknown room', async () => {
      const sm = createStateManager(statePath);
      const result = await sm.getLastChecked('unknown-room-id');
      assert.strictEqual(result, null);
    });
  });

  describe('markChecked + getLastChecked', () => {
    it('should round-trip a timestamp', async () => {
      const sm = createStateManager(statePath);
      const ts = await sm.markChecked('room-1');
      const result = await sm.getLastChecked('room-1');
      assert.strictEqual(result, ts);
    });

    it('should use a custom timestamp when provided', async () => {
      const sm = createStateManager(statePath);
      const custom = '2025-01-15T10:00:00.000Z';
      const ts = await sm.markChecked('room-2', custom);
      assert.strictEqual(ts, custom);
      const result = await sm.getLastChecked('room-2');
      assert.strictEqual(result, custom);
    });

    it('should overwrite previous timestamp', async () => {
      const sm = createStateManager(statePath);
      await sm.markChecked('room-1', '2025-01-01T00:00:00.000Z');
      await sm.markChecked('room-1', '2025-02-01T00:00:00.000Z');
      const result = await sm.getLastChecked('room-1');
      assert.strictEqual(result, '2025-02-01T00:00:00.000Z');
    });
  });

  describe('persistence across instances', () => {
    it('should persist state to disk and reload in new instance', async () => {
      const sm1 = createStateManager(statePath);
      await sm1.markChecked('room-persist', '2025-06-01T12:00:00.000Z');

      // Create a new instance pointing at the same file
      const sm2 = createStateManager(statePath);
      const result = await sm2.getLastChecked('room-persist');
      assert.strictEqual(result, '2025-06-01T12:00:00.000Z');
    });
  });

  describe('markAllChecked', () => {
    it('should mark multiple rooms at once', async () => {
      const sm = createStateManager(statePath);
      const ts = await sm.markAllChecked(['room-a', 'room-b', 'room-c']);

      assert.strictEqual(await sm.getLastChecked('room-a'), ts);
      assert.strictEqual(await sm.getLastChecked('room-b'), ts);
      assert.strictEqual(await sm.getLastChecked('room-c'), ts);
    });

    it('should handle empty array', async () => {
      const sm = createStateManager(statePath);
      const ts = await sm.markAllChecked([]);
      assert.ok(ts); // should still return a timestamp
    });
  });

  describe('corrupt file recovery', () => {
    it('should recover from corrupt JSON and reset to empty state', async () => {
      // Write corrupt JSON to state file
      await fs.mkdir(path.dirname(statePath), { recursive: true });
      await fs.writeFile(statePath, '{invalid json!!!', 'utf-8');

      const sm = createStateManager(statePath);
      const result = await sm.getLastChecked('any-room');
      assert.strictEqual(result, null);

      // Should be able to write new state after recovery
      await sm.markChecked('room-after-recovery');
      const check = await sm.getLastChecked('room-after-recovery');
      assert.ok(check);
    });
  });

  describe('file permissions', () => {
    it('should write state file with 0o600 permissions', async () => {
      const sm = createStateManager(statePath);
      await sm.markChecked('room-perms');

      const stats = await fs.stat(statePath);
      const mode = stats.mode & 0o777;
      assert.strictEqual(mode, 0o600, `Expected 0o600 permissions, got 0o${mode.toString(8)}`);
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      const sm = createStateManager(statePath);
      await sm.markChecked('room-x');
      await sm.reset();
      const result = await sm.getLastChecked('room-x');
      assert.strictEqual(result, null);
    });
  });
});
