import stateManager from '../../../lib/state.js';

/**
 * Mark a specific room as checked (updates the "last checked" timestamp).
 *
 * @param {Object} args
 * @param {string} args.roomId - The ID of the room to mark as checked (required)
 * @returns {Promise<Object>} Result with success, roomId, and checkedAt
 */
const executeFunction = async ({ roomId }) => {
  try {
    const checkedAt = await stateManager.markChecked(roomId);
    return {
      success: true,
      roomId,
      checkedAt
    };
  } catch (error) {
    console.error('Error marking room as checked:', error);
    return {
      error: error.message || 'An error occurred while marking the room as checked.'
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'mark_room_checked',
      description: 'Mark a specific Webex room as checked. Updates the "last checked" timestamp so that subsequent calls to get_all_unread will only return messages sent after this point.',
      parameters: {
        type: 'object',
        properties: {
          roomId: {
            type: 'string',
            description: 'The ID of the room to mark as checked.'
          }
        },
        required: ['roomId']
      }
    }
  }
};

export { apiTool };
