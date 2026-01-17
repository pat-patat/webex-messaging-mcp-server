---
name: webex-resources
description: How to resolve Webex resources like space links, room IDs, people, and messages. Use when working with Webex URLs, IDs, or finding users/spaces.
---

# Webex Resource Resolution

This skill teaches how to resolve and work with Webex resources without trial and error.

## Space/Room Link Formats

### Deep Link Format
```
webexteams://im?space=<uuid>
```
Example: `webexteams://im?space=078b4340-bb02-11ee-9ae2-81c7c613996c`

**To convert to API room ID:**
```bash
echo -n "ciscospark://us/ROOM/<uuid>" | base64
```
Example:
```bash
echo -n "ciscospark://us/ROOM/078b4340-bb02-11ee-9ae2-81c7c613996c" | base64
# Returns: Y2lzY29zcGFyazovL3VzL1JPT00vMDc4YjQzNDAtYmIwMi0xMWVlLTlhZTItODFjN2M2MTM5OTZj
```

### Web Link Format
```
https://web.webex.com/spaces/<roomId>
```
The `<roomId>` is already base64-encoded, use directly with API.

## ID Patterns

All Webex IDs are base64-encoded URIs:

| Resource | URI Pattern | Decoded Example |
|----------|-------------|-----------------|
| Room | `ciscospark://us/ROOM/<uuid>` | `Y2lzY29zcGFyazovL3VzL1JPT00v...` |
| Person | `ciscospark://us/PEOPLE/<uuid>` | `Y2lzY29zcGFyazovL3VzL1BFT1BMRS...` |
| Message | `ciscospark://us/MESSAGE/<uuid>` | `Y2lzY29zcGFyazovL3VzL01FU1NBR0Uv...` |
| Team | `ciscospark://us/TEAM/<uuid>` | `Y2lzY29zcGFyazovL3VzL1RFQU0v...` |

**To decode an ID:**
```bash
echo "<base64-id>" | base64 -d
```

**To encode a URI to ID:**
```bash
echo -n "ciscospark://us/ROOM/<uuid>" | base64
```

## Finding People

### By Display Name
```javascript
// Use list_people with displayName parameter
list_people({ displayName: "Yann Esposito" })
```

### By Email
```javascript
// Use list_people with email parameter
list_people({ email: "user@cisco.com" })
```

### Get Person Details
```javascript
// Use the personId from list_people results
get_person_details({ personId: "Y2lzY29zcGFyazovL3VzL1BFT1BMRS..." })
```

## Finding Rooms/Spaces

### List Direct Message Rooms
```javascript
// Get all 1:1 conversations, sorted by recent activity
list_rooms({ type: "direct", sortBy: "lastactivity" })
```

### List Group Spaces
```javascript
// Get all group spaces
list_rooms({ type: "group", sortBy: "lastactivity" })
```

### Find Direct Room with Specific Person
1. List direct rooms: `list_rooms({ type: "direct" })`
2. Match by `title` (person's display name)

## Sending Messages

### To a Room/Space
```javascript
create_message({ roomId: "<room-id>", text: "Hello" })
```

### Direct to Person (by email)
```javascript
create_message({ toPersonEmail: "user@cisco.com", text: "Hello" })
```

### Direct to Person (by ID)
```javascript
create_message({ toPersonId: "<person-id>", text: "Hello" })
```

### Reply in Thread
```javascript
create_message({
  roomId: "<room-id>",
  parentId: "<parent-message-id>",
  text: "Reply"
})
```

## Common Workflows

### Get Space Info from Link
1. Extract UUID from `webexteams://im?space=<uuid>`
2. Convert: `echo -n "ciscospark://us/ROOM/<uuid>" | base64`
3. Call `get_room_details({ roomId: "<base64-id>" })`

### Find and Message Someone
1. `list_people({ displayName: "Name" })` or `list_people({ email: "..." })`
2. Get `personId` from results
3. `create_message({ toPersonId: "<id>", text: "..." })`

### Read Recent Messages from Space
1. Get room ID (from link or `list_rooms`)
2. `list_messages({ roomId: "<id>", max: 10 })`
