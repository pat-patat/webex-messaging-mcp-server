import { getWebexUrl, getWebexHeaders } from '../../../lib/webex-config.js';
import stateManager from '../../../lib/state.js';

/**
 * Extract essential fields from a message to reduce response size.
 * @private
 */
const summarizeMessage = (msg) => ({
  id: msg.id,
  personEmail: msg.personEmail,
  personId: msg.personId,
  created: msg.created,
  text: msg.text,
  parentId: msg.parentId,
  roomType: msg.roomType
});

/**
 * Fetch messages from a room since a given timestamp, paginating backward.
 * @private
 */
const fetchMessagesSince = async (roomId, since, headers) => {
  const messages = [];
  const sinceDate = new Date(since);
  let cursor = undefined;
  const batchSize = 100;
  const maxIterations = 20;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const url = new URL(getWebexUrl('/messages'));
    url.searchParams.append('roomId', roomId);
    url.searchParams.append('max', batchSize.toString());
    if (cursor) url.searchParams.append('beforeMessage', cursor);

    const response = await fetch(url.toString(), { method: 'GET', headers });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(JSON.stringify(errorData));
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) break;

    let foundOlder = false;
    for (const msg of data.items) {
      if (new Date(msg.created) > sinceDate) {
        messages.push(msg);
      } else {
        foundOlder = true;
        break;
      }
    }

    if (foundOlder) break;
    cursor = data.items[data.items.length - 1].id;
    if (data.items.length < batchSize) break;
  }

  return messages;
};

/**
 * Fetch new messages from ALL rooms since last check.
 *
 * @returns {Promise<Object>} Structured result with rooms, totalRooms, totalMessages, checkedAt
 */
const executeFunction = async () => {
  try {
    const headers = await getWebexHeaders();
    const checkedAt = new Date().toISOString();

    // List all rooms sorted by last activity
    const roomsUrl = new URL(getWebexUrl('/rooms'));
    roomsUrl.searchParams.append('max', '200');
    roomsUrl.searchParams.append('sortBy', 'lastactivity');

    const roomsResponse = await fetch(roomsUrl.toString(), { method: 'GET', headers });

    if (!roomsResponse.ok) {
      const errorData = await roomsResponse.json();
      throw new Error(JSON.stringify(errorData));
    }

    const roomsData = await roomsResponse.json();
    const allRooms = roomsData.items || [];

    const rooms = [];
    let totalMessages = 0;

    for (const room of allRooms) {
      try {
        const lastChecked = await stateManager.getLastChecked(room.id);

        // If never checked, skip (would return all messages ever)
        if (!lastChecked) continue;

        const messages = await fetchMessagesSince(room.id, lastChecked, headers);
        if (messages.length === 0) continue;

        const summarized = messages.map(summarizeMessage);
        totalMessages += summarized.length;

        rooms.push({
          roomId: room.id,
          title: room.title,
          type: room.type,
          messageCount: summarized.length,
          messages: summarized
        });
      } catch (roomError) {
        // Per-room error isolation: log and continue
        rooms.push({
          roomId: room.id,
          title: room.title,
          type: room.type,
          error: roomError.message || 'Failed to fetch messages'
        });
      }
    }

    return {
      rooms,
      totalRooms: rooms.length,
      totalMessages,
      checkedAt
    };
  } catch (error) {
    console.error('Error fetching unread messages:', error);
    return {
      error: error.message || 'An error occurred while fetching unread messages.',
      details: error.stack
    };
  }
};

const apiTool = {
  function: executeFunction,
  definition: {
    type: 'function',
    function: {
      name: 'get_all_unread',
      description: 'Fetch new messages from ALL rooms since the last time each room was checked. Rooms that have never been marked as checked are skipped. Returns a structured summary with per-room message lists.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
};

export { apiTool };
