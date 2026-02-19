/**
 * State Manager Module
 * Tracks per-room "last checked" timestamps for unread message tracking.
 * State is stored at ~/.webex-mcp/state.json by default.
 */

import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_STATE_DIR = path.join(os.homedir(), '.webex-mcp');
const DEFAULT_STATE_FILE = path.join(DEFAULT_STATE_DIR, 'state.json');

/**
 * Create a state manager instance for a given file path.
 * Uses lazy-loading: state is read from disk on first access.
 * @param {string} [statePath] - Path to the state JSON file
 * @returns {Object} State manager with getLastChecked, markChecked, markAllChecked, reset
 */
export function createStateManager(statePath = DEFAULT_STATE_FILE) {
  let state = null;

  async function load() {
    if (state !== null) return;
    try {
      const data = await fs.readFile(statePath, 'utf-8');
      state = JSON.parse(data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        state = {};
        return;
      }
      if (err instanceof SyntaxError) {
        console.warn(`[State] Corrupt state file at ${statePath}, resetting to empty state`);
        state = {};
        return;
      }
      throw err;
    }
  }

  async function save() {
    const dir = path.dirname(statePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  }

  async function getLastChecked(roomId) {
    await load();
    return state[roomId] || null;
  }

  async function markChecked(roomId, timestamp = new Date().toISOString()) {
    await load();
    state[roomId] = timestamp;
    await save();
    return timestamp;
  }

  async function markAllChecked(roomIds, timestamp = new Date().toISOString()) {
    await load();
    for (const roomId of roomIds) {
      state[roomId] = timestamp;
    }
    await save();
    return timestamp;
  }

  async function reset() {
    state = {};
    await save();
  }

  return { getLastChecked, markChecked, markAllChecked, reset };
}

// Default singleton for production use
const defaultStateManager = createStateManager();

export default defaultStateManager;
