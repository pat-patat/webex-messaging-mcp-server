/**
 * Token Manager Module
 * High-level orchestration of OAuth token lifecycle
 */

import { loadTokens, saveTokens, isTokenExpired, isTokenExpiringSoon } from './token-storage.js';
import { startOAuthFlow } from './browser-flow.js';
import { getOAuthConfig, hasOAuthCredentials, WEBEX_TOKEN_URL } from './oauth-config.js';

// In-memory token cache
let cachedToken = null;

// Auto-refresh timer
let refreshTimer = null;

/**
 * Get a valid access token
 * Handles token refresh and OAuth flow as needed
 * @returns {Promise<string>} Valid access token
 */
export async function getValidToken() {
  // Return cached token if valid and not expiring soon
  if (cachedToken && !isTokenExpiringSoon({ expiresAt: cachedToken.expiresAt })) {
    return cachedToken.accessToken;
  }

  // Try to load from file storage
  const stored = await loadTokens();

  if (stored) {
    // If not expired, use it
    if (!isTokenExpired(stored)) {
      cachedToken = stored;
      scheduleRefresh(stored);
      return stored.accessToken;
    }

    // Try to refresh if we have a refresh token
    if (stored.refreshToken) {
      try {
        console.error('[OAuth] Token expired, refreshing...');
        const refreshed = await refreshAccessToken(stored.refreshToken);
        cachedToken = refreshed;
        await saveTokens(refreshed);
        scheduleRefresh(refreshed);
        console.error('[OAuth] Token refreshed successfully');
        return refreshed.accessToken;
      } catch (err) {
        console.error('[OAuth] Refresh failed, re-authenticating:', err.message);
      }
    }
  }

  // No valid token - need fresh OAuth flow
  return initiateOAuthFlow();
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token data
 */
export async function refreshAccessToken(refreshToken) {
  const config = getOAuthConfig();

  const response = await fetch(WEBEX_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type,
  };
}

/**
 * Initiate browser-based OAuth flow
 * @returns {Promise<string>} Access token
 */
export async function initiateOAuthFlow() {
  const config = getOAuthConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      'OAuth not configured. Set WEBEX_OAUTH_CLIENT_ID and WEBEX_OAUTH_CLIENT_SECRET, ' +
      'or use WEBEX_PUBLIC_WORKSPACE_API_KEY for static token authentication.'
    );
  }

  console.error('[OAuth] Starting browser-based authentication...');

  const tokens = await startOAuthFlow(config);
  cachedToken = tokens;
  await saveTokens(tokens);
  scheduleRefresh(tokens);

  console.error('[OAuth] Authentication successful!');
  return tokens.accessToken;
}

/**
 * Schedule automatic token refresh
 * @param {Object} tokens - Token data with expiresAt
 */
function scheduleRefresh(tokens) {
  // Clear any existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  // Calculate refresh time (5 minutes before expiry)
  const refreshIn = Math.max(0, tokens.expiresAt - Date.now() - 5 * 60 * 1000);

  // Don't schedule if token expires very soon or is already expired
  if (refreshIn <= 0) {
    return;
  }

  refreshTimer = setTimeout(async () => {
    try {
      console.error('[OAuth] Auto-refreshing token...');
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      cachedToken = refreshed;
      await saveTokens(refreshed);
      scheduleRefresh(refreshed);
      console.error('[OAuth] Token auto-refreshed successfully');
    } catch (err) {
      console.error('[OAuth] Auto-refresh failed:', err.message);
      // Clear cached token so next request triggers re-auth
      cachedToken = null;
    }
  }, refreshIn);
}

/**
 * Update the cached token (used by webex-config after initialization)
 * @param {string} token - Access token to cache
 */
export function setCachedToken(token) {
  cachedToken = { accessToken: token, expiresAt: Infinity };
}

/**
 * Get the current cached token (for synchronous access after init)
 * @returns {string|null} Cached access token or null
 */
export function getCachedToken() {
  return cachedToken?.accessToken || null;
}

/**
 * Get authentication status information
 * @returns {Promise<Object>} Auth status with token info
 */
export async function getAuthStatus() {
  const stored = await loadTokens();

  if (!stored) {
    return {
      authenticated: false,
      method: null,
      message: 'No OAuth tokens stored'
    };
  }

  const expired = isTokenExpired(stored);
  const expiringSoon = isTokenExpiringSoon(stored);

  return {
    authenticated: !expired,
    method: 'oauth',
    expiresAt: stored.expiresAt ? new Date(stored.expiresAt).toISOString() : null,
    expiresIn: stored.expiresAt ? Math.max(0, Math.round((stored.expiresAt - Date.now()) / 1000)) : 0,
    expired,
    expiringSoon,
    hasRefreshToken: !!stored.refreshToken
  };
}

/**
 * Force re-authentication by clearing tokens and initiating new OAuth flow
 * @returns {Promise<string>} New access token
 */
export async function forceReauthenticate() {
  const { clearTokens } = await import('./token-storage.js');
  await clearTokens();
  cachedToken = null;
  return initiateOAuthFlow();
}

// Re-export hasOAuthCredentials for convenience
export { hasOAuthCredentials };
