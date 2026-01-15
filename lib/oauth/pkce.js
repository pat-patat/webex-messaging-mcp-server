/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Implements RFC 7636 for secure OAuth authorization code flow
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Generate a cryptographically secure code verifier
 * @returns {string} 43-character base64url-encoded random string
 */
export function generateCodeVerifier() {
  // 32 bytes = 43 characters in base64url encoding
  return randomBytes(32).toString('base64url');
}

/**
 * Generate code challenge from verifier using S256 method
 * @param {string} verifier - The code verifier
 * @returns {string} SHA-256 hash of verifier, base64url-encoded
 */
export function generateCodeChallenge(verifier) {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns {string} Random state string
 */
export function generateState() {
  return randomBytes(16).toString('base64url');
}
