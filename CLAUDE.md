# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server that provides AI assistants with access to Cisco Webex messaging capabilities through 52 Webex API tools. It's a fork of the official webex/webex-messaging-mcp-server with added OAuth authentication support and in-app authentication management via MCP prompts.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Run tests (120 tests)
npm test

# Start server (STDIO mode - for Claude Desktop/Code)
node mcpServer.js

# Start server (HTTP mode)
npm run start:http

# List available tools
node index.js tools

# Validate (lint + tests)
npm run validate
```

## Authentication

Two authentication methods are supported (configured in `.env`):

1. **Static API Token** (original method):
   ```
   WEBEX_PUBLIC_WORKSPACE_API_KEY=your-token
   ```

2. **OAuth** (recommended - browser-based login with token refresh):
   ```
   WEBEX_OAUTH_CLIENT_ID=your-client-id
   WEBEX_OAUTH_CLIENT_SECRET=your-client-secret
   ```

Static token takes priority if both are configured. OAuth tokens are stored at `~/.webex-mcp/tokens.json`.

### Authentication Management

Authentication options appear in the `/mcp` menu when you select the Webex server:

- **Login to Webex** - Authenticate with Webex using OAuth (opens browser)
- **Re-authenticate** - Force new OAuth flow (for expired sessions or switching accounts)
- **Clear authentication** - Logout and clear stored tokens

The server starts without requiring authentication. Use the Login prompt when ready.

## Architecture

### Key Files

- `mcpServer.js` - Main MCP server, supports STDIO and HTTP transports, registers auth prompts
- `lib/webex-config.js` - Centralized authentication and API configuration
- `lib/oauth/` - OAuth 2.0 implementation with PKCE and auto-refresh
- `lib/tools.js` - Dynamic tool discovery and loading
- `tools/paths.js` - Registry of all 52 tool paths

### Tool Pattern

All tools follow this structure in `tools/webex-public-workspace/webex-messaging/`:

```javascript
import { getWebexUrl, getWebexHeaders } from '../../../lib/webex-config.js';

const executeFunction = async (params) => {
  const response = await fetch(getWebexUrl('/endpoint'), {
    headers: getWebexHeaders(),
    method: 'GET'
  });
  return response.json();
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'tool_name',
      description: '...',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
};

export { apiTool };
```

### Authentication Flow

1. `mcpServer.js` starts without requiring authentication (lazy auth)
2. User selects "Login to Webex" from `/mcp` menu when ready
3. `initializeAuth()` checks for static token first, then OAuth
4. OAuth flow opens browser, stores tokens to `~/.webex-mcp/tokens.json`
5. Tokens auto-refresh 5 minutes before expiry
6. All tools use `getWebexHeaders()` which returns cached token
7. User can use "Re-authenticate" or "Clear authentication" from `/mcp` menu

## Testing

Tests require auth initialization. Pattern used in test files:

```javascript
import { initializeAuth } from '../lib/webex-config.js';

beforeEach(async () => {
  process.env.WEBEX_PUBLIC_WORKSPACE_API_KEY = 'test-token';
  await initializeAuth();
});
```

## Adding New Tools

1. Create file in `tools/webex-public-workspace/webex-messaging/`
2. Follow the tool pattern above using `getWebexUrl()` and `getWebexHeaders()`
3. Add path to `tools/paths.js`
4. Run `npm test` to verify
