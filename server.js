const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Application state
let appState = {
    participants: [],
    connections: {},
    currentPage: 'registration', // 'registration', 'connections', 'visualization'
    adminId: null,
    registeredSockets: new Set() // Track which sockets have already registered
};

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    console.log('Current adminId:', appState.adminId);
    console.log('Participants:', appState.participants.map(p => `${p.name}(${p.id})`));

    // Send current state to new connection
    socket.emit('appState', appState);

    // Handle participant registration
    socket.on('registerParticipant', (data) => {
        const { name, isAdminOnly } = data;
        
        // Check if this socket has already registered
        if (appState.registeredSockets.has(socket.id)) {
            socket.emit('registrationError', 'You have already registered. Please wait for the admin to advance.');
            return;
        }
        
        // Check if name already exists
        if (appState.participants.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase())) {
            socket.emit('registrationError', 'This name is already being used. Please choose another one.');
            return;
        }
        
        // Check if this is the first participant (admin) - only if no admin exists yet
        if (!appState.adminId) {
            appState.adminId = socket.id;
        }

        // Add participant if not admin-only or if admin wants to participate
        if (!isAdminOnly) {
            const participant = {
                id: socket.id,
                name: name.trim(),
                isAdmin: appState.adminId === socket.id
            };
            appState.participants.push(participant);
            
            // Initialize connections for this participant
            appState.connections[socket.id] = [];
        }
        
        // Mark this socket as registered
        appState.registeredSockets.add(socket.id);

        // Broadcast updated state
        io.emit('appState', appState);
        
        // Notify about admin status and registration success
        if (appState.adminId === socket.id) {
            socket.emit('adminStatus', true);
        }
        socket.emit('registrationSuccess');
    });

    // Handle page advancement (admin only)
    socket.on('advancePage', () => {
        if (socket.id === appState.adminId) {
            if (appState.currentPage === 'registration') {
                appState.currentPage = 'connections';
            } else if (appState.currentPage === 'connections') {
                appState.currentPage = 'visualization';
            }
            io.emit('appState', appState);
        }
    });

    // Handle going back to connections (admin only)
    socket.on('backToConnections', () => {
        if (socket.id === appState.adminId) {
            appState.currentPage = 'connections';
            io.emit('appState', appState);
        }
    });

    // Handle connection toggle
    socket.on('toggleConnection', (data) => {
        const { targetParticipantId } = data;
        const sourceId = socket.id;
        
        console.log('toggleConnection:', {
            sourceId,
            targetParticipantId,
            sourceName: appState.participants.find(p => p.id === sourceId)?.name || 'not found',
            targetName: appState.participants.find(p => p.id === targetParticipantId)?.name || 'not found'
        });

        if (!appState.connections[sourceId]) {
            appState.connections[sourceId] = [];
        }
        if (!appState.connections[targetParticipantId]) {
            appState.connections[targetParticipantId] = [];
        }

        // Toggle bidirectional connection
        const sourceConnections = appState.connections[sourceId];
        const targetConnections = appState.connections[targetParticipantId];

        if (sourceConnections.includes(targetParticipantId)) {
            // Remove connection
            appState.connections[sourceId] = sourceConnections.filter(id => id !== targetParticipantId);
            appState.connections[targetParticipantId] = targetConnections.filter(id => id !== sourceId);
        } else {
            // Add connection
            appState.connections[sourceId].push(targetParticipantId);
            appState.connections[targetParticipantId].push(sourceId);
        }

        // Broadcast updated connections
        io.emit('connectionsUpdate', appState.connections);
    });

    // Handle reset (admin only)
    socket.on('resetAll', () => {
        if (socket.id === appState.adminId) {
            appState = {
                participants: [],
                connections: {},
                currentPage: 'registration',
                adminId: null,
                registeredSockets: new Set()
            };
            io.emit('appState', appState);
            io.emit('resetComplete');
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove from registered sockets
        appState.registeredSockets.delete(socket.id);
        
        // Remove participant from the list
        appState.participants = appState.participants.filter(p => p.id !== socket.id);
        
        // Remove their connections
        delete appState.connections[socket.id];
        
        // Remove them from other participants' connections
        Object.keys(appState.connections).forEach(participantId => {
            appState.connections[participantId] = appState.connections[participantId].filter(id => id !== socket.id);
        });

        // If admin disconnected, assign new admin from remaining participants
        if (appState.adminId === socket.id) {
            if (appState.participants.length > 0) {
                appState.adminId = appState.participants[0].id;
                const newAdmin = appState.participants.find(p => p.id === appState.adminId);
                if (newAdmin) {
                    newAdmin.isAdmin = true;
                    // Notify the new admin
                    io.to(appState.adminId).emit('adminStatus', true);
                }
            } else {
                appState.adminId = null;
            }
        }

        // Broadcast updated state
        io.emit('appState', appState);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});