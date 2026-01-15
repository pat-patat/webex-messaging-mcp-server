/**
 * OAuth Configuration Module
 * Defines Webex OAuth endpoints and loads credentials from environment
 */

import path from 'path';
import os from 'os';

// Webex OAuth endpoints
export const WEBEX_AUTHORIZE_URL = 'https://webexapis.com/v1/authorize';
export const WEBEX_TOKEN_URL = 'https://webexapis.com/v1/access_token';

// Token storage location
export const TOKEN_DIR = path.join(os.homedir(), '.webex-mcp');
export const TOKEN_FILE = path.join(TOKEN_DIR, 'tokens.json');

// Default scope for full messaging access
export const DEFAULT_SCOPE = 'spark:all';

/**
 * Get OAuth configuration from environment variables
 * @returns {Object} OAuth configuration
 */
export function getOAuthConfig() {
  return {
    clientId: process.env.WEBEX_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.WEBEX_OAUTH_CLIENT_SECRET || '',
    scope: process.env.WEBEX_OAUTH_SCOPE || DEFAULT_SCOPE,
  };
}

/**
 * Check if OAuth credentials are configured
 * @returns {boolean} True if client ID and secret are set
 */
export function hasOAuthCredentials() {
  const config = getOAuthConfig();
  return !!(config.clientId && config.clientSecret);
}
