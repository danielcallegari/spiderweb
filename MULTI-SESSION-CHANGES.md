# Multi-Session Support - Implementation Summary

## Overview
The application has been upgraded from supporting a single global session to supporting multiple concurrent sessions. Multiple teams can now use the application simultaneously without interfering with each other.

## Key Changes

### 1. Server-Side (server.js)

**State Management:**
- Replaced single `appState` object with a `Map` of sessions
- Each session is identified by a unique 6-character code (e.g., "ABC123")
- Sessions are isolated using Socket.IO rooms

**New Functions:**
- `getOrCreateSession(sessionId)` - Retrieves or creates a session
- `generateSessionCode()` - Creates human-readable 6-character session codes
- `cleanupEmptySessions()` - Automatically removes empty sessions after 1 hour (runs every 15 minutes)

**New Socket Events:**
- `createSession` - Creates a new session and returns the session ID
- `joinSession` - Joins an existing session by ID
- `sessionCreated` - Emitted when a new session is created
- `sessionJoined` - Emitted when successfully joined a session
- `sessionError` - Emitted when there's an error with session operations

**Modified Socket Events:**
All existing events now require and use `sessionId`:
- `registerParticipant({ sessionId, name, isAdminOnly })`
- `advancePage({ sessionId })`
- `backToConnections({ sessionId })`
- `toggleConnection({ sessionId, targetParticipantId })`
- `resetAll({ sessionId })`

**Broadcasting:**
- Changed from global `io.emit()` to room-based `io.to(sessionId).emit()`
- Ensures updates only go to users in the same session

### 2. Frontend HTML (index.html)

**New Page:**
- Added `sessionSelectionPage` as the initial landing page
- Two options: "Create New Session" or "Join Existing Session"
- Session code input for joining existing sessions

**Session Display:**
- Added session info header showing current session code
- "Copy Link" button to share the session URL with team members

**Page Flow:**
1. Session Selection (new)
2. Registration
3. Connections
4. Visualization

### 3. Frontend JavaScript (app.js)

**Session State:**
- Added `currentSessionId` variable to track active session
- Session ID stored in URL query parameter (`?session=ABC123`)

**New Functions:**
- `initializeSession()` - Checks URL for session ID or shows selection page
- `createSession()` - Requests new session creation
- `joinSessionByCode()` - Joins session by entering code
- `updateSessionDisplay()` - Updates session code in header
- `copySessionCode()` - Copies shareable session URL to clipboard

**Event Handling:**
- All socket emissions now include `sessionId` parameter
- Session ID persists in URL for bookmarking and sharing
- Automatic rejoin on reconnection if session ID is known

### 4. Frontend CSS (styles.css)

**New Styles:**
- `.session-info` - Session code display in header
- `.copy-btn` - Copy link button styling
- `.session-selection-content` - Session selection page layout
- `.session-options` - Flex layout for create/join options
- `.session-option` - Individual option cards with hover effects
- `.session-divider` - "OR" divider between options
- `.join-session-input` - Session code input field styling

## Usage

### Creating a New Session:
1. Navigate to the application
2. Click "Create New Session"
3. A 6-character session code is generated (e.g., "ABC123")
4. Share the session link or code with team members
5. Proceed to register as normal

### Joining an Existing Session:
1. Navigate to the application
2. Enter the 6-character session code
3. Click "Join Session"
4. Proceed to register as normal

### Sharing a Session:
- Use the "📋 Copy Link" button in the header
- Or manually share the session code
- Team members can join via URL: `http://yoursite.com?session=ABC123`

## Technical Details

### Session Isolation:
- Each session has its own:
  - Participant list
  - Connection mappings
  - Current page state
  - Administrator
  - Registration tracking

### Session Lifecycle:
- **Creation:** When first user creates or joins with a new code
- **Active:** While participants are connected
- **Cleanup:** Empty sessions are removed after 1 hour of inactivity

### URL Structure:
- Clean URLs with session parameter: `/?session=ABC123`
- Shareable and bookmarkable
- Automatically parsed on page load

### Socket.IO Rooms:
- Each session corresponds to one Socket.IO room
- Rooms provide automatic message isolation
- Users can only be in one session at a time

## Migration Notes

### Breaking Changes:
- Old URLs without session ID will show session selection page
- Existing sessions (if any were running) will not persist after restart
- All socket events now require sessionId parameter

### No Breaking Changes:
- Session-internal functionality remains identical
- UI/UX for registration, connections, and visualization unchanged
- Admin controls work the same within a session

## Future Enhancements (Not Implemented):

- Database persistence for session recovery
- Session passwords/access control
- Session history/analytics
- Maximum session duration limits
- Session participant limits
- Named sessions (friendly names in addition to codes)

## Version
Updated from 0.1 to support multi-session architecture (still 0.1 with multi-session support).
