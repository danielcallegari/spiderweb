// WebSocket connection
const socket = io();

// Session state
let currentSessionId = null;

// Socket event handlers
socket.on('resetComplete', () => {
    // After reset, reset local state
    isRegistered = false;
    isAdmin = false;
    currentUser = null;
    // isFirstUser will be determined from appState
    showRegistrationForm();
    updateRegistrationUI();
});

// Application state
let currentUser = null;
let isAdmin = false;
let isRegistered = false;
let isFirstUser = false; // Track if this user is the first (admin)
let appState = {
    participants: [],
    connections: {},
    currentPage: 'registration',
    adminId: null
};

// DOM elements
const pages = {
    sessionSelection: document.getElementById('sessionSelectionPage'),
    registration: document.getElementById('registrationPage'),
    connections: document.getElementById('connectionsPage'),
    visualization: document.getElementById('visualizationPage')
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeSession();
});

socket.on('connect', () => {
    console.log('Connected to server');
    // Reset first user status on connection
    isFirstUser = false;
    isRegistered = false;
    isAdmin = false;
    console.log('Reset states on connect - isFirstUser:', isFirstUser);
    
    // If we have a session ID, rejoin the session
    if (currentSessionId) {
        socket.emit('joinSession', { sessionId: currentSessionId });
    }
});

// Session management events
socket.on('sessionCreated', ({ sessionId }) => {
    console.log('Session created:', sessionId);
    currentSessionId = sessionId;
    updateSessionDisplay();
    
    // Join the newly created session
    socket.emit('joinSession', { sessionId });
});

socket.on('sessionJoined', ({ sessionId }) => {
    console.log('Joined session:', sessionId);
    currentSessionId = sessionId;
    updateSessionDisplay();
    
    // Update URL with session ID
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    window.history.pushState({}, '', url);
    
    // Show registration page
    showPage('registration');
    
    // Focus on name input
    setTimeout(() => {
        const nameInput = document.getElementById('nameInput');
        if (nameInput) nameInput.focus();
    }, 100);
});

socket.on('sessionError', (message) => {
    alert(message);
    showPage('sessionSelection');
});

// Socket event listeners
socket.on('appState', (state) => {
    appState = state;
    
    // Determine first user status based on app state
    // Only show admin UI if no admin exists AND no participants exist
    const shouldBeFirstUser = !state.adminId && state.participants.length === 0;
    
    console.log('appState received:', {
        adminId: state.adminId,
        participantsCount: state.participants.length,
        shouldBeFirstUser,
        currentIsFirstUser: isFirstUser
    });
    
    // Update first user status based on app state
    if (shouldBeFirstUser !== isFirstUser) {
        isFirstUser = shouldBeFirstUser;
        console.log('Updated isFirstUser to:', isFirstUser);
    }
    
    updateUI();
    showPage(state.currentPage);
});

socket.on('firstUserStatus', (status) => {
    console.log('Received firstUserStatus:', status, 'Current isFirstUser:', isFirstUser);
    isFirstUser = status;
    console.log('Set isFirstUser to:', isFirstUser);
    // Immediately update the UI when first user status changes
    updateRegistrationUI();
    updateAdminNotificationVisibility();
});

socket.on('resetComplete', () => {
    // After reset, reset local state
    isRegistered = false;
    isAdmin = false;
    currentUser = null;
    // isFirstUser will be set by the firstUserStatus event from server
    showRegistrationForm();
    updateRegistrationUI();
});

socket.on('adminStatus', (status) => {
    isAdmin = status;
    updateAdminControls();
});

socket.on('registrationSuccess', () => {
    isRegistered = true;
    isFirstUser = false; // Clear first user status after registration
    updateRegistrationUI();
});

socket.on('registrationError', (message) => {
    alert(message);
    // Show the form again if there was an error
    showRegistrationForm();
});

socket.on('connectionsUpdate', (connections) => {
    appState.connections = connections;
    updateConnectionsUI();
});

// Event listeners setup
function setupEventListeners() {
    // Registration page
    document.getElementById('nameInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            registerParticipant();
        }
    });

    document.getElementById('nameInput').addEventListener('input', (e) => {
        if (!isRegistered) {
            updateAdminNotificationVisibility();
        }
    });
    
    // Session code input
    document.getElementById('sessionCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinSessionByCode();
        }
    });
}

// Session management functions
function initializeSession() {
    // Check if there's a session ID in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    if (sessionId) {
        // Try to join the session from URL
        currentSessionId = sessionId;
        socket.emit('joinSession', { sessionId });
    } else {
        // Show session selection page
        showPage('sessionSelection');
    }
}

function createSession() {
    socket.emit('createSession');
}

function joinSessionByCode() {
    const input = document.getElementById('sessionCodeInput');
    const sessionId = input.value.trim().toUpperCase();
    
    if (!sessionId) {
        alert('Please enter a session code.');
        return;
    }
    
    if (sessionId.length !== 6) {
        alert('Session code must be 6 characters long.');
        return;
    }
    
    currentSessionId = sessionId;
    socket.emit('joinSession', { sessionId });
}

function updateSessionDisplay() {
    const sessionInfo = document.getElementById('sessionInfo');
    const sessionCodeEl = document.getElementById('sessionCode');
    
    if (currentSessionId) {
        sessionCodeEl.textContent = currentSessionId;
        sessionInfo.classList.remove('hidden');
    } else {
        sessionInfo.classList.add('hidden');
    }
}

function copySessionCode() {
    if (!currentSessionId) return;
    
    // Create full URL with session ID
    const url = new URL(window.location.origin);
    url.searchParams.set('session', currentSessionId);
    
    // Copy to clipboard
    navigator.clipboard.writeText(url.toString()).then(() => {
        const btn = document.getElementById('copySessionBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy link. Session code: ' + currentSessionId);
    });
}

// Registration functions
function registerParticipant() {
    const nameInput = document.getElementById('nameInput');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a valid name.');
        return;
    }

    if (isRegistered) {
        alert('You have already registered. Please wait for the admin to advance.');
        return;
    }
    
    if (!currentSessionId) {
        alert('No active session. Please join or create a session first.');
        return;
    }

    // Immediately hide input elements when register button is clicked
    hideRegistrationForm();

    const isAdminOnly = document.getElementById('adminOnlyCheckbox').checked;
    
    socket.emit('registerParticipant', { sessionId: currentSessionId, name, isAdminOnly });
    
    // Store current user info
    currentUser = { name, id: socket.id };
}

// Page navigation
function showPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
    }

    // Update page-specific content
    if (pageName === 'connections') {
        updateConnectionsPage();
    } else if (pageName === 'visualization') {
        updateVisualizationPage();
    }
}

function advancePage() {
    if (!isAdmin) return;
    
    if (appState.currentPage === 'registration' && appState.participants.length === 0) {
        alert('At least one participant is required to advance.');
        return;
    }
    
    if (!currentSessionId) return;
    
    socket.emit('advancePage', { sessionId: currentSessionId });
}

function backToConnections() {
    if (!isAdmin) return;
    
    if (!currentSessionId) return;
    
    socket.emit('backToConnections', { sessionId: currentSessionId });
}

function resetAll() {
    if (!isAdmin) return;
    
    if (confirm('Are you sure you want to clear all data and restart the application?')) {
        if (!currentSessionId) return;
        
        socket.emit('resetAll', { sessionId: currentSessionId });
        currentUser = null;
        isAdmin = false;
        isRegistered = false;
        // Don't reset isFirstUser here - let server determine it
        showRegistrationForm();
        updateRegistrationUI();
    }
}

// UI Update functions
function updateUI() {
    updateParticipantsList();
    updateAdminControls();
    updateRegistrationUI();
}

function updateRegistrationUI() {
    const nameInput = document.getElementById('nameInput');
    const registerBtn = document.getElementById('registerBtn');
    const adminOptions = document.getElementById('adminOptions');
    const adminNotification = document.getElementById('adminNotification');
    const waitingMessage = document.getElementById('waitingMessage');
    
    if (isRegistered) {
        // Keep everything hidden or disabled after registration
        nameInput.disabled = true;
        registerBtn.style.display = 'none';
        adminOptions.classList.add('hidden');
        adminNotification.classList.add('hidden');
        waitingMessage.classList.remove('hidden');
    } else {
        // Show form elements if not registered
        nameInput.style.display = 'block';
        registerBtn.style.display = 'block';
        nameInput.disabled = false;
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register';
        waitingMessage.classList.add('hidden');
        
        // Update admin notification visibility
        updateAdminNotificationVisibility();
    }
}

function updateAdminNotificationVisibility() {
    const adminNotification = document.getElementById('adminNotification');
    const adminOptions = document.getElementById('adminOptions');
    const nameInput = document.getElementById('nameInput');
    
    console.log('updateAdminNotificationVisibility called:', {
        isFirstUser,
        isRegistered,
        participantsLength: appState.participants.length
    });
    
    // Only show admin notification if this user is first user AND not yet registered
    if (isFirstUser && !isRegistered && appState.participants.length === 0) {
        console.log('SHOWING admin notification');
        // Show admin notification immediately for first user
        adminNotification.classList.remove('hidden');
        adminOptions.classList.remove('hidden');
        
    } else {
        console.log('HIDING admin notification');
        // Hide both notification and options for non-first users or after registration
        adminNotification.classList.add('hidden');
        adminOptions.classList.add('hidden');
    }
}

function hideRegistrationForm() {
    const nameInput = document.getElementById('nameInput');
    const registerBtn = document.getElementById('registerBtn');
    const adminOptions = document.getElementById('adminOptions');
    const adminNotification = document.getElementById('adminNotification');
    
    // Immediately hide the form elements
    nameInput.style.display = 'none';
    registerBtn.style.display = 'none';
    adminOptions.classList.add('hidden');
    adminNotification.classList.add('hidden');
}

function showRegistrationForm() {
    const nameInput = document.getElementById('nameInput');
    const registerBtn = document.getElementById('registerBtn');
    
    // Show the form elements again
    nameInput.style.display = 'block';
    registerBtn.style.display = 'block';
    nameInput.disabled = false;
    registerBtn.disabled = false;
    registerBtn.textContent = 'Register';
}

function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    const noParticipants = document.getElementById('noParticipants');
    
    if (appState.participants.length === 0) {
        list.innerHTML = '';
        noParticipants.style.display = 'block';
    } else {
        noParticipants.style.display = 'none';
        list.innerHTML = appState.participants.map(participant => `
            <li>
                ${participant.name}
                ${participant.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
            </li>
        `).join('');
    }
}

function updateAdminControls() {
    const controls = document.getElementById('adminControls');
    const connectionsControls = document.getElementById('connectionsAdminControls');
    const visualizationControls = document.getElementById('visualizationAdminControls');
    
    if (isAdmin) {
        controls.classList.remove('hidden');
        connectionsControls.classList.remove('hidden');
        visualizationControls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
        connectionsControls.classList.add('hidden');
        visualizationControls.classList.add('hidden');
    }
}

// Connections page functions
function updateConnectionsPage() {
    if (!currentUser) return;
    
    const userNameEl = document.getElementById('currentUserName');
    const connectionsList = document.getElementById('connectionsList');
    const connectionsInstruction = document.getElementById('connectionsInstruction');
    
    // Check if current user is admin-only (registered but not in participants list)
    const isAdminOnly = isAdmin && !appState.participants.some(p => p.id === currentUser.id);
    
    if (isAdminOnly) {
        // Admin-only should not see connection interface
        userNameEl.textContent = currentUser.name + ' (Administrator - Not Participating)';
        connectionsInstruction.style.display = 'none'; // Hide the instruction
        connectionsList.innerHTML = '<p class="empty-state">As an administrator-only user, you do not participate in team connections. Please use the controls below to advance when ready.</p>';
        return;
    }
    
    // Show instruction for regular participants
    connectionsInstruction.style.display = 'block';
    userNameEl.textContent = currentUser.name;
    
    // Get other participants (excluding current user)
    const otherParticipants = appState.participants.filter(p => p.id !== currentUser.id);
    
    console.log('updateConnectionsPage:', {
        currentUserId: currentUser.id,
        allParticipants: appState.participants.map(p => `${p.name}(${p.id})`),
        otherParticipants: otherParticipants.map(p => `${p.name}(${p.id})`)
    });
    
    connectionsList.innerHTML = otherParticipants.map((participant, index) => {
        const isConnected = appState.connections[currentUser.id] && 
                           appState.connections[currentUser.id].includes(participant.id);
        
        console.log(`Rendering ${participant.name} with id: ${participant.id}, connected: ${isConnected}`);
        
        return `
            <div class="connection-item ${isConnected ? 'connected' : ''}" 
                 data-participant-id="${participant.id}" data-participant-index="${index}">
                <div class="connection-toggle">
                    <span class="connection-name">${participant.name}</span>
                    <div class="connection-status"></div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add click event listeners to connection items
    document.querySelectorAll('.connection-item').forEach((item) => {
        item.addEventListener('click', function() {
            const participantId = this.getAttribute('data-participant-id');
            console.log('Connection item clicked, participantId:', participantId);
            toggleConnection(participantId);
        });
    });
}

function toggleConnection(targetParticipantId) {
    if (!currentUser) return;
    if (!currentSessionId) return;
    
    console.log('toggleConnection called:', {
        currentUserId: currentUser.id,
        targetParticipantId: targetParticipantId
    });
    socket.emit('toggleConnection', { sessionId: currentSessionId, targetParticipantId });
}

function toggleConnection(targetParticipantId) {
    if (!currentUser) return;
    if (!currentSessionId) return;
    
    socket.emit('toggleConnection', { sessionId: currentSessionId, targetParticipantId });
}

function updateConnectionsUI() {
    if (appState.currentPage === 'connections') {
        updateConnectionsPage();
    } else if (appState.currentPage === 'visualization') {
        updateVisualizationPage();
    }
}

// Visualization page functions
function updateVisualizationPage() {
    updateSpiderGraph();
    updateConnectionMatrix();
    updateStatistics();
}

function showTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="showTab('${tabName}')"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Refresh content for specific tabs
    if (tabName === 'graph') {
        updateSpiderGraph();
    }
}

function updateSpiderGraph() {
    const svg = document.getElementById('spiderGraph');
    const svgRect = svg.getBoundingClientRect();
    const centerX = 300;
    const centerY = 300;
    const radius = 200;
    
    // Clear previous content
    svg.innerHTML = '';
    
    const participants = appState.participants;
    if (participants.length === 0) return;
    
    // Calculate positions for participants (in a circle)
    const angleStep = (2 * Math.PI) / participants.length;
    const positions = participants.map((participant, index) => {
        const angle = index * angleStep - Math.PI / 2; // Start from top
        return {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
            participant
        };
    });
    
    // Draw connections first (so they appear behind nodes)
    positions.forEach((pos1, i) => {
        const connections = appState.connections[pos1.participant.id] || [];
        connections.forEach(connectedId => {
            const pos2 = positions.find(p => p.participant.id === connectedId);
            if (pos2) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', pos1.x);
                line.setAttribute('y1', pos1.y);
                line.setAttribute('x2', pos2.x);
                line.setAttribute('y2', pos2.y);
                line.setAttribute('stroke', '#667eea');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('opacity', '0.6');
                svg.appendChild(line);
            }
        });
    });
    
    // Draw participant nodes
    positions.forEach(pos => {
        // Get connection count for this participant
        const connectionCount = (appState.connections[pos.participant.id] || []).length;
        
        // Node circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pos.x);
        circle.setAttribute('cy', pos.y);
        circle.setAttribute('r', '25');
        circle.setAttribute('fill', '#48bb78');
        circle.setAttribute('stroke', '#2d3748');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
        
        // Connection count inside the node
        const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        countText.setAttribute('x', pos.x);
        countText.setAttribute('y', pos.y + 5); // Centered vertically in the circle
        countText.setAttribute('text-anchor', 'middle');
        countText.setAttribute('fill', 'white');
        countText.setAttribute('font-size', '18');
        countText.setAttribute('font-weight', 'bold');
        countText.textContent = connectionCount;
        svg.appendChild(countText);
        
        // Participant name below the node
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', pos.x);
        text.setAttribute('y', pos.y + 45);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#2d3748');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = pos.participant.name;
        svg.appendChild(text);
    });
}

function updateConnectionMatrix() {
    const container = document.getElementById('connectionMatrix');
    const participants = appState.participants;
    
    if (participants.length === 0) {
        container.innerHTML = '<p class="empty-state">No participants available.</p>';
        return;
    }
    
    let html = '<table class="matrix-table"><thead><tr><th></th>';
    
    // Header row
    participants.forEach(p => {
        html += `<th>${p.name}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Data rows
    participants.forEach(participant => {
        html += `<tr><td class="name-cell">${participant.name}</td>`;
        
        participants.forEach(otherParticipant => {
            let cellClass = '';
            let cellContent = '';
            
            if (participant.id === otherParticipant.id) {
                cellClass = 'matrix-cell-self';
                cellContent = '-';
            } else {
                const connections = appState.connections[participant.id] || [];
                const isConnected = connections.includes(otherParticipant.id);
                cellClass = isConnected ? 'matrix-cell-connected' : '';
                cellContent = isConnected ? '✓' : '';
            }
            
            html += `<td class="${cellClass}">${cellContent}</td>`;
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function updateStatistics() {
    const container = document.getElementById('statisticsContent');
    const participants = appState.participants;
    
    if (participants.length === 0) {
        container.innerHTML = '<p class="empty-state">No participants available.</p>';
        return;
    }
    
    // Calculate statistics
    const totalParticipants = participants.length;
    const totalPossibleConnections = totalParticipants * (totalParticipants - 1) / 2;
    
    // Count actual connections
    let actualConnections = 0;
    const participantStats = [];
    
    participants.forEach(participant => {
        const connections = appState.connections[participant.id] || [];
        const integrationRate = totalParticipants > 1 ? (connections.length / (totalParticipants - 1)) * 100 : 0;
        
        participantStats.push({
            name: participant.name,
            connections: connections.length,
            integrationRate: integrationRate
        });
        
        actualConnections += connections.length;
    });
    
    // Each connection is counted twice (bidirectional), so divide by 2
    actualConnections = actualConnections / 2;
    
    const teamIntegrationRate = totalPossibleConnections > 0 ? (actualConnections / totalPossibleConnections) * 100 : 0;
    
    // Sort participants by integration rate
    participantStats.sort((a, b) => b.integrationRate - a.integrationRate);
    
    let html = `
        <div class="stat-card">
            <div class="stat-title">Number of Participants</div>
            <div class="stat-value">${totalParticipants}</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-title">Team Integration Level</div>
            <div class="stat-value">${teamIntegrationRate.toFixed(1)}%</div>
            <div class="integration-bar">
                <div class="integration-fill ${getIntegrationClass(teamIntegrationRate)}" 
                     style="width: ${teamIntegrationRate}%"></div>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-title">Individual Integration (ordered from highest to lowest)</div>
            <div class="participant-stats">
    `;
    
    participantStats.forEach(stat => {
        html += `
            <div class="participant-stat">
                <div>
                    <strong>${stat.name}</strong><br>
                    <small>${stat.connections} connections</small>
                </div>
                <div>
                    <div>${stat.integrationRate.toFixed(1)}%</div>
                    <div class="integration-bar">
                        <div class="integration-fill ${getIntegrationClass(stat.integrationRate)}" 
                             style="width: ${stat.integrationRate}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function getIntegrationClass(rate) {
    if (rate >= 80) return 'integration-very-high';
    if (rate >= 60) return 'integration-high';
    if (rate >= 40) return 'integration-medium';
    if (rate >= 20) return 'integration-low';
    return 'integration-very-low';
}