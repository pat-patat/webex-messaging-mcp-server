/**
 * Token Manager
 * Orchestrates token retrieval and caching for manual authentication flow
 */

import { storeToken, loadToken, clearToken } from './index.js';
import { openWebexPortal, readTokenFromClipboard } from './browser-automation.js';

// Internal state
let _cachedToken = null;
let _tokenExpiresAt = null;
let _onTokenRefreshed = null;

/**
 * Set a callback to be called when token is refreshed
 * @param {Function} callback - Callback function that receives the new token
 */
export function setTokenRefreshCallback(callback) {
  _onTokenRefreshed = callback;
}

/**
 * Get a valid token from cache or Keychain
 * @returns {Promise<string>} The valid access token
 * @throws {Error} If no valid token is available
 */
export async function getValidToken() {
  // First, check if we have a valid cached token in memory
  if (_cachedToken && _tokenExpiresAt && _tokenExpiresAt > new Date()) {
    return _cachedToken;
  }

  // Check Keychain for stored token
  const stored = await loadToken();

  if (stored && stored.expiresAt > new Date()) {
    _cachedToken = stored.token;
    _tokenExpiresAt = stored.expiresAt;
    console.error('[TokenManager] Using valid token from Keychain');
    return stored.token;
  }

  // Token is missing or expired - user must authenticate manually
  throw new Error(
    'Token expired or missing. Please use /webex:authenticate to login.'
  );
}

/**
 * Start manual authentication - opens browser and returns instructions
 * @returns {Promise<{instructions: string}>}
 */
export async function startManualAuth() {
  console.error('[TokenManager] Starting manual authentication...');
  return await openWebexPortal();
}

/**
 * Complete manual authentication - reads token from clipboard and stores it
 * @returns {Promise<string>} The new access token
 */
export async function completeManualAuth() {
  console.error('[TokenManager] Reading token from clipboard...');

  const { token, expiresAt } = await readTokenFromClipboard();

  // Store in Keychain
  await storeToken(token, expiresAt);

  // Cache in memory
  _cachedToken = token;
  _tokenExpiresAt = expiresAt;

  // No automatic refresh scheduling for manual flow

  // Notify callback if set
  if (_onTokenRefreshed) {
    _onTokenRefreshed(token);
  }

  console.error(`[TokenManager] Token stored, expires at ${expiresAt.toISOString()}`);

  return token;
}

/**
 * Get the current cached token (if any)
 * @returns {string|null}
 */
export function getCachedToken() {
  if (_cachedToken && _tokenExpiresAt && _tokenExpiresAt > new Date()) {
    return _cachedToken;
  }
  return null;
}

/**
 * Clear the cached token from memory and Keychain
 */
export async function clearCachedToken() {
  _cachedToken = null;
  _tokenExpiresAt = null;
  await clearToken();
  console.error('[TokenManager] Token cache cleared');
}

/**
 * Get token status information
 * @returns {Promise<Object>}
 */
export async function getTokenStatus() {
  const stored = await loadToken();

  if (!stored) {
    return {
      hasToken: false,
      isValid: false,
      expiresAt: null,
      expiresIn: null
    };
  }

  const now = new Date();
  const isValid = stored.expiresAt > now;
  const expiresIn = isValid ? Math.round((stored.expiresAt.getTime() - now.getTime()) / 1000 / 60) : 0;

  return {
    hasToken: true,
    isValid,
    expiresAt: stored.expiresAt.toISOString(),
    expiresIn: isValid ? `${expiresIn} minutes` : 'expired'
  };
}
