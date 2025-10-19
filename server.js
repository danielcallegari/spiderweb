const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Multi-session state management
const sessions = new Map();

// Helper function to get or create a session
function getOrCreateSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            id: sessionId,
            participants: [],
            connections: {},
            currentPage: 'registration',
            adminId: null,
            registeredSockets: new Set(),
            createdAt: Date.now()
        });
        console.log(`Created new session: ${sessionId}`);
    }
    return sessions.get(sessionId);
}

// Generate a human-readable session code
function generateSessionCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Cleanup empty sessions (run periodically)
function cleanupEmptySessions() {
    const now = Date.now();
    const timeout = 60 * 60 * 1000; // 1 hour
    
    for (const [sessionId, session] of sessions.entries()) {
        if (session.participants.length === 0 && (now - session.createdAt) > timeout) {
            sessions.delete(sessionId);
            console.log(`Cleaned up empty session: ${sessionId}`);
        }
    }
}

// Run cleanup every 15 minutes
setInterval(cleanupEmptySessions, 15 * 60 * 1000);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle session creation
    socket.on('createSession', () => {
        const sessionId = generateSessionCode();
        const session = getOrCreateSession(sessionId);
        socket.emit('sessionCreated', { sessionId });
        console.log(`Session created: ${sessionId} by ${socket.id}`);
    });

    // Handle joining a session
    socket.on('joinSession', ({ sessionId }) => {
        if (!sessionId) {
            socket.emit('sessionError', 'Session ID is required');
            return;
        }

        const session = getOrCreateSession(sessionId);
        socket.join(sessionId);
        
        // Send current session state to the joining user
        socket.emit('appState', session);
        socket.emit('sessionJoined', { sessionId });
        
        console.log(`User ${socket.id} joined session ${sessionId}`);
        console.log(`Session ${sessionId} - adminId: ${session.adminId}, participants: ${session.participants.map(p => p.name).join(', ')}`);
    });

    // Handle participant registration
    socket.on('registerParticipant', ({ sessionId, name, isAdminOnly }) => {
        if (!sessionId) {
            socket.emit('registrationError', 'Session ID is required');
            return;
        }

        const session = getOrCreateSession(sessionId);
        
        // Check if this socket has already registered
        if (session.registeredSockets.has(socket.id)) {
            socket.emit('registrationError', 'You have already registered. Please wait for the admin to advance.');
            return;
        }
        
        // Check if name already exists in this session
        if (session.participants.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
            socket.emit('registrationError', 'This name is already being used. Please choose another one.');
            return;
        }
        
        // Check if this is the first participant (admin) - only if no admin exists yet
        if (!session.adminId) {
            session.adminId = socket.id;
        }

        // Add participant if not admin-only or if admin wants to participate
        if (!isAdminOnly) {
            const participant = {
                id: socket.id,
                name: name.trim(),
                isAdmin: session.adminId === socket.id
            };
            session.participants.push(participant);
            
            // Initialize connections for this participant
            session.connections[socket.id] = [];
        }
        
        // Mark this socket as registered
        session.registeredSockets.add(socket.id);

        // Broadcast updated state to all users in this session
        io.to(sessionId).emit('appState', session);
        
        // Notify about admin status and registration success
        if (session.adminId === socket.id) {
            socket.emit('adminStatus', true);
        }
        socket.emit('registrationSuccess');
        
        console.log(`User ${socket.id} registered as ${name} in session ${sessionId}`);
    });

    // Handle page advancement (admin only)
    socket.on('advancePage', ({ sessionId }) => {
        if (!sessionId) return;
        
        const session = sessions.get(sessionId);
        if (!session) return;
        
        if (socket.id === session.adminId) {
            if (session.currentPage === 'registration') {
                session.currentPage = 'connections';
            } else if (session.currentPage === 'connections') {
                session.currentPage = 'visualization';
            }
            io.to(sessionId).emit('appState', session);
        }
    });

    // Handle going back to connections (admin only)
    socket.on('backToConnections', ({ sessionId }) => {
        if (!sessionId) return;
        
        const session = sessions.get(sessionId);
        if (!session) return;
        
        if (socket.id === session.adminId) {
            session.currentPage = 'connections';
            io.to(sessionId).emit('appState', session);
        }
    });

    // Handle connection toggle
    socket.on('toggleConnection', ({ sessionId, targetParticipantId }) => {
        if (!sessionId) return;
        
        const session = sessions.get(sessionId);
        if (!session) return;
        
        const sourceId = socket.id;
        
        console.log('toggleConnection:', {
            sessionId,
            sourceId,
            targetParticipantId,
            sourceName: session.participants.find(p => p.id === sourceId)?.name || 'not found',
            targetName: session.participants.find(p => p.id === targetParticipantId)?.name || 'not found'
        });

        if (!session.connections[sourceId]) {
            session.connections[sourceId] = [];
        }
        if (!session.connections[targetParticipantId]) {
            session.connections[targetParticipantId] = [];
        }

        // Toggle bidirectional connection
        const sourceConnections = session.connections[sourceId];
        const targetConnections = session.connections[targetParticipantId];

        if (sourceConnections.includes(targetParticipantId)) {
            // Remove connection
            session.connections[sourceId] = sourceConnections.filter(id => id !== targetParticipantId);
            session.connections[targetParticipantId] = targetConnections.filter(id => id !== sourceId);
        } else {
            // Add connection
            session.connections[sourceId].push(targetParticipantId);
            session.connections[targetParticipantId].push(sourceId);
        }

        // Broadcast updated connections to all users in this session
        io.to(sessionId).emit('connectionsUpdate', session.connections);
    });

    // Handle reset (admin only)
    socket.on('resetAll', ({ sessionId }) => {
        if (!sessionId) return;
        
        const session = sessions.get(sessionId);
        if (!session) return;
        
        if (socket.id === session.adminId) {
            // Reset session to initial state
            session.participants = [];
            session.connections = {};
            session.currentPage = 'registration';
            session.adminId = null;
            session.registeredSockets = new Set();
            
            io.to(sessionId).emit('appState', session);
            io.to(sessionId).emit('resetComplete');
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find which session(s) this socket was in and clean up
        for (const [sessionId, session] of sessions.entries()) {
            // Check if this socket was in this session
            if (session.registeredSockets.has(socket.id) || session.participants.some(p => p.id === socket.id)) {
                // Remove from registered sockets
                session.registeredSockets.delete(socket.id);
                
                // Remove participant from the list
                session.participants = session.participants.filter(p => p.id !== socket.id);
                
                // Remove their connections
                delete session.connections[socket.id];
                
                // Remove them from other participants' connections
                Object.keys(session.connections).forEach(participantId => {
                    session.connections[participantId] = session.connections[participantId].filter(id => id !== socket.id);
                });

                // If admin disconnected, assign new admin from remaining participants
                if (session.adminId === socket.id) {
                    if (session.participants.length > 0) {
                        session.adminId = session.participants[0].id;
                        const newAdmin = session.participants.find(p => p.id === session.adminId);
                        if (newAdmin) {
                            newAdmin.isAdmin = true;
                            // Notify the new admin
                            io.to(session.adminId).emit('adminStatus', true);
                        }
                    } else {
                        session.adminId = null;
                    }
                }

                // Broadcast updated state to remaining users in the session
                io.to(sessionId).emit('appState', session);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});