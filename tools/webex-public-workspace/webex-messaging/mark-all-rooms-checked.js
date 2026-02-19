import { getWebexUrl, getWebexHeaders } from '../../../lib/webex-config.js';
import stateManager from '../../../lib/state.js';

/**
 * Mark all accessible rooms as checked.
 * Lists all rooms via the Webex API and marks each one with the current timestamp.
 *
 * @returns {Promise<Object>} Result with success, roomsMarked count, and checkedAt
 */
const executeFunction = async () => {
  try {
    const headers = await getWebexHeaders();

    // List all rooms
    const url = new URL(getWebexUrl('/rooms'));
    url.searchParams.append('max', '200');
    url.searchParams.append('sortBy', 'lastactivity');

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    const rooms = data.items || [];
    const roomIds = rooms.map(room => room.id);

    const checkedAt = await stateManager.markAllChecked(roomIds);

    return {
      success: true,
      roomsMarked: roomIds.length,
      checkedAt
    };
  } catch (error) {
    console.error('Error marking all rooms as checked:', error);
    return {
      error: error.message || 'An error occurred while marking all rooms as checked.'
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'mark_all_rooms_checked',
      description: 'Mark all accessible Webex rooms as checked. Lists all rooms and updates their "last checked" timestamps so that subsequent calls to get_all_unread will only return messages sent after this point.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

export { apiTool };
