/**
 * Browser-assisted Token Extraction
 * Opens browser for user to manually copy token, then reads from clipboard
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const WEBEX_DEVELOPER_PORTAL = 'https://developer.webex.com/docs/getting-started';
const TOKEN_LIFETIME_HOURS = 12;

/**
 * Open the Webex developer portal in the default browser
 * User will manually copy the token
 * @returns {Promise<{instructions: string}>}
 */
export async function openWebexPortal() {
  if (process.platform !== 'darwin') {
    throw new Error('Browser automation is only supported on macOS');
  }

  console.error('[Browser] Opening Webex developer portal...');

  await execAsync(`open "${WEBEX_DEVELOPER_PORTAL}"`);

  return {
    instructions: [
      '1. Log in to your Webex account if needed',
      '2. Click on your profile photo at the top right',
      '3. Find the "Bearer" field with your personal access token',
      '4. Click the copy button next to the token',
      '5. Click OK on the confirmation popup',
      '6. Come back here and confirm when done'
    ].join('\n')
  };
}

/**
 * Read token from clipboard after user has copied it
 * @returns {Promise<{token: string, expiresAt: Date}>}
 */
export async function readTokenFromClipboard() {
  if (process.platform !== 'darwin') {
    throw new Error('Clipboard reading is only supported on macOS');
  }

  const { stdout } = await execAsync('pbpaste');
  const token = stdout.trim();

  if (!token || token.length < 50 || token.includes(' ')) {
    throw new Error(
      'Invalid token in clipboard. Please copy the Bearer token from the Webex developer portal.'
    );
  }

  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_HOURS * 60 * 60 * 1000);

  console.error('[Browser] Token read from clipboard successfully');

  return { token, expiresAt };
}
