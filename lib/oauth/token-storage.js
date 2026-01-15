/**
 * Token Storage Module
 * Handles secure file-based storage of OAuth tokens
 */

import { promises as fs } from 'fs';
import { TOKEN_DIR, TOKEN_FILE } from './oauth-config.js';

/**
 * Load tokens from file storage
 * @returns {Promise<Object|null>} Token data or null if not found
 */
export async function loadTokens() {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Save tokens to file storage with secure permissions
 * @param {Object} tokens - Token data to save
 * @param {string} tokens.accessToken - Access token
 * @param {string} tokens.refreshToken - Refresh token
 * @param {number} tokens.expiresAt - Expiration timestamp (ms)
 */
export async function saveTokens(tokens) {
  // Ensure directory exists with 700 permissions (owner only)
  await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });

  // Write token file with 600 permissions (owner read/write only)
  await fs.writeFile(
    TOKEN_FILE,
    JSON.stringify(tokens, null, 2),
    { mode: 0o600 }
  );
}

/**
 * Remove token file
 */
export async function clearTokens() {
  try {
    await fs.unlink(TOKEN_FILE);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Check if token is expired
 * @param {Object} tokens - Token data
 * @returns {boolean} True if expired
 */
export function isTokenExpired(tokens) {
  if (!tokens?.expiresAt) {
    return true;
  }
  return Date.now() >= tokens.expiresAt;
}

/**
 * Check if token is expiring soon (within buffer period)
 * @param {Object} tokens - Token data
 * @param {number} bufferMs - Buffer time in milliseconds (default: 5 minutes)
 * @returns {boolean} True if expiring soon
 */
export function isTokenExpiringSoon(tokens, bufferMs = 5 * 60 * 1000) {
  if (!tokens?.expiresAt) {
    return true;
  }
  return Date.now() >= (tokens.expiresAt - bufferMs);
}
