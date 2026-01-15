/**
 * Browser-based OAuth Flow
 * Handles the OAuth authorization code flow with PKCE via browser
 */

import http from 'http';
import { URL } from 'url';
import open from 'open';
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce.js';
import { WEBEX_AUTHORIZE_URL, WEBEX_TOKEN_URL } from './oauth-config.js';

// Timeout for OAuth flow (5 minutes)
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Exchange authorization code for tokens
 * @param {Object} params - Exchange parameters
 * @returns {Promise<Object>} Token data
 */
async function exchangeCodeForTokens({ code, codeVerifier, clientId, clientSecret, redirectUri }) {
  const response = await fetch(WEBEX_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
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
 * Generate HTML response for OAuth callback
 * @param {boolean} success - Whether auth was successful
 * @param {string} message - Message to display
 * @returns {string} HTML content
 */
function generateCallbackHtml(success, message) {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '&#10004;' : '&#10006;';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Webex MCP Authentication</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .icon {
      font-size: 3rem;
      color: ${color};
    }
    h1 { color: #333; margin: 1rem 0; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <h1>${success ? 'Authentication Successful!' : 'Authentication Failed'}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

/**
 * Start the browser-based OAuth flow
 * @param {Object} config - OAuth configuration
 * @param {string} config.clientId - OAuth client ID
 * @param {string} config.clientSecret - OAuth client secret
 * @param {string} config.scope - OAuth scope
 * @returns {Promise<Object>} Token data
 */
export async function startOAuthFlow({ clientId, clientSecret, scope }) {
  return new Promise((resolve, reject) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();

    let timeoutId;

    // Create temporary server for OAuth callback
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/callback') {
        clearTimeout(timeoutId);

        const code = url.searchParams.get('code');
        const returnedState = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(generateCallbackHtml(false, errorDescription || error));
          server.close();
          reject(new Error(`OAuth error: ${errorDescription || error}`));
          return;
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(generateCallbackHtml(false, 'Invalid state parameter. Please try again.'));
          server.close();
          reject(new Error('State mismatch - possible CSRF attack'));
          return;
        }

        try {
          const tokens = await exchangeCodeForTokens({
            code,
            codeVerifier,
            clientId,
            clientSecret,
            redirectUri: `http://localhost:${server.address().port}/callback`,
          });

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(generateCallbackHtml(true, 'You can close this window and return to Claude.'));
          server.close();
          resolve(tokens);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(generateCallbackHtml(false, `Token exchange failed: ${err.message}`));
          server.close();
          reject(err);
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`OAuth callback server error: ${err.message}`));
    });

    // Listen on random available port
    server.listen(0, 'localhost', () => {
      const port = server.address().port;
      const redirectUri = `http://localhost:${port}/callback`;

      // Build authorization URL
      const authUrl = new URL(WEBEX_AUTHORIZE_URL);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      console.error('[OAuth] Opening browser for Webex authentication...');
      console.error(`[OAuth] If browser doesn't open, visit: ${authUrl.toString()}`);

      // Open browser
      open(authUrl.toString()).catch(() => {
        // Browser open failed, user will use the printed URL
        console.error('[OAuth] Could not open browser automatically. Please use the URL above.');
      });
    });

    // Timeout after 5 minutes
    timeoutId = setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout - no callback received within 5 minutes. Please try again.'));
    }, OAUTH_TIMEOUT_MS);
  });
}
