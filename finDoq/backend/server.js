const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Update route handling - place these before API routes
app.get(['/', '/login', '/signup', '/dashboard', '/admin'], (req, res) => {
    const page = req.path === '/' ? 'index' : req.path.substring(1);
    res.sendFile(path.join(__dirname, `../frontend/pages/${page}.html`));
});

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const creditRoutes = require('./routes/credits');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');

// API routes should come after page routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user/profile', profileRoutes);

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        // Handle different message types
        switch(data.type) {
            case 'subscribe':
                ws.userId = data.userId;
                break;
        }
    });
});

// Broadcast to specific user
global.notifyUser = (userId, data) => {
    wss.clients.forEach(client => {
        if (client.userId === userId) {
            client.send(JSON.stringify(data));
        }
    });
};

// Replace app.listen with server.listen
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
