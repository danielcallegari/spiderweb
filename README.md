# spiderweb - The Spider's Web

What it is: 
spiderweb is a web app that helps assess the degree of integration of a group of people in a team.

**(c) Daniel Callegari, 2025**

## Overview

Spiderweb allows team members to register and indicate which colleagues they have effectively worked with. The application then visualizes these connections in a "spider web" graph, providing insights into team integration levels both individually and collectively.

## Technologies

### Backend
- **Node.js** with Express.js
- **Socket.IO** for real-time bidirectional communication
- **UUID** for unique identification

### Frontend
- **HTML5** and **CSS3**
- **Vanilla JavaScript** (no frontend framework)
- **Socket.IO Client** for WebSocket connections
- **SVG** for dynamic graph visualization

### Hosting
- Configured for **Render.com** deployment

## Features

### 1. Registration Page
The home page allows participants to register with their name and join the assessment session.

#### Key Features:
- **Real-time participant list**: As participants register, their names appear in a live-updating list visible to all connected users
- **First user becomes administrator**: The first person to register is automatically assigned as the administrator
- **Administrator notification**: First user sees a clear notification of their administrator status
- **Admin-only mode**: Administrators can choose to manage the session without participating in the assessment themselves (their name won't appear in the participant list)
- **Duplicate name prevention**: The system prevents multiple participants from using the same name
- **One registration per socket**: Each connection can only register once, preventing duplicate registrations

#### Administrator Controls:
- **Clear All**: Removes all participants and resets the application to its initial state
- **Advance**: Moves all participants to the Connections page

### 2. Connections Page
Allows each participant to mark which other team members they have effectively worked with.

#### Key Features:
- **Personalized view**: Each participant sees their own name at the top with instructions
- **Toggle connections**: Click on any participant's name to toggle the connection status
- **Bidirectional connections**: When participant A marks a connection with participant B, the connection is automatically recorded for both A→B and B→A
- **Real-time synchronization**: All connection updates are immediately broadcast to all participants
- **Visual feedback**: Connected participants are highlighted with visual indicators
- **Admin-only exclusion**: Users who registered as admin-only do not participate in connections and see an appropriate message

#### Administrator Controls:
- **Advance to Visualization**: Moves all participants to the final visualization page

### 3. Visualization Page
Presents team integration data through multiple visualization formats.

#### Three Interactive Tabs:

**Graph Tab - "The Spider's Web"**
- Participants arranged in a circle as nodes (green circles)
- Connection lines between participants who worked together
- Connection count displayed inside each node
- Participant names labeled below each node
- Dynamic SVG rendering

**Matrix Tab**
- Cross-reference table with all participants in both rows and columns
- Checkmarks (✓) indicate connections between pairs
- Self-connections marked with dash (-)
- Clean, easy-to-read table format

**Statistics Tab**
- **Total participants count**
- **Team integration level**: Overall percentage based on actual vs. possible connections
- **Individual integration rates**: Each participant's connection percentage sorted from highest to lowest
- **Color-coded integration bars**: Visual indicators with 5 levels:
  - Very High (≥80%): Green
  - High (≥60%): Light green  
  - Medium (≥40%): Yellow
  - Low (≥20%): Orange
  - Very Low (<20%): Red
- **Connection counts**: Number of connections per participant

#### Administrator Controls:
- **Back to Connections**: Return to the Connections page to edit associations
- **Reset All**: Clear all data and restart the application from the beginning

## Real-Time Features

All participants experience synchronized state through WebSocket connections:
- Participant list updates instantly as new users register
- Connection changes are broadcast immediately to all clients
- Page navigation is synchronized across all participants
- Administrator changes affect all connected users in real-time
- Disconnected users are automatically removed from the session, with admin role reassigned if necessary

## Installation & Usage

See [INSTALL.md](INSTALL.md) for detailed installation instructions.

### Quick Start
```bash
npm install
npm start
```

The application will be available at `http://localhost:3000`

## Application State Management

The server maintains a centralized game state that includes:
- List of registered participants with their socket IDs and admin status
- Bidirectional connection mappings between all participants
- Current page state (registration, connections, or visualization)
- Administrator socket ID
- Set of registered socket connections to prevent duplicate registrations

## Architecture Highlights

- **Server-side state management**: Single source of truth on the Node.js server
- **Event-driven communication**: Socket.IO events for all user interactions
- **Stateless client**: Clients receive full state updates and render accordingly
- **Automatic admin succession**: If the admin disconnects, the next participant becomes admin
- **Session persistence**: State maintained as long as server is running
- **Graceful disconnection handling**: Participants removed cleanly with connection cleanup

## Versioning

**Version 0.1** - Initial release, vibe-coded with Claude Sonnet 4 :)
**Version 0.2** - Added support for multiple sessions


