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

// Database initialization and migrations
const { db, initializeTables } = require('./config/database');
const { runMigrations } = require('./utils/migration');

// Create a settings table to track initialization state
const initializeOnce = () => {
    return new Promise((resolve, reject) => {
        // Check if settings table exists
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`, (err, table) => {
            if (err) {
                console.error("Error checking settings table:", err);
                reject(err);
                return;
            }
            
            if (!table) {
                // First time setup - create settings table
                db.serialize(() => {
                    console.log("First time setup - initializing database...");
                    
                    // Create settings table
                    db.run(`CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT
                    )`, (err) => {
                        if (err) {
                            console.error("Error creating settings table:", err);
                            reject(err);
                            return;
                        }
                        
                        // Initialize tables
                        initializeTables();
                        
                        // Run migrations and make sure to handle the Promise
                        runMigrations()
                            .then(() => {
                                // Mark as initialized
                                db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, 
                                    ['db_initialized', 'true'], 
                                    (err) => {
                                        if (err) {
                                            reject(err);
                                            return;
                                        }
                                        
                                        // Also set version
                                        db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`,
                                            ['db_version', '1.0'],
                                            (err) => {
                                                if (err) {
                                                    reject(err);
                                                    return;
                                                }
                                                resolve();
                                            }
                                        );
                                    }
                                );
                            })
                            .catch(err => {
                                console.error("Migration error:", err);
                                reject(err);
                            });
                    });
                });
            } else {
                // Check if we need to run migrations (can be triggered by version updates)
                db.get(`SELECT value FROM settings WHERE key = 'db_version'`, (err, version) => {
                    if (err) {
                        console.error("Error checking db version:", err);
                        reject(err);
                        return;
                    }
                    
                    const currentVersion = '1.0'; // Update this when schema changes
                    
                    if (!version || version.value !== currentVersion) {
                        console.log("Database version update detected, running migrations...");
                        
                        // Make sure to handle the Promise returned by runMigrations
                        runMigrations()
                            .then(() => {
                                // Update version
                                const query = version 
                                    ? `UPDATE settings SET value = ? WHERE key = 'db_version'`
                                    : `INSERT INTO settings (key, value) VALUES (?, ?)`;
                                const params = version ? [currentVersion] : ['db_version', currentVersion];
                                
                                db.run(query, params, (err) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }
                                    resolve();
                                });
                            })
                            .catch(err => {
                                console.error("Migration error:", err);
                                reject(err);
                            });
                    } else {
                        console.log("Database already initialized, skipping setup");
                        resolve();
                    }
                });
            }
        });
    });
};

// Initialize database once at startup
initializeOnce()
    .then(() => {
        console.log("Database ready");
    })
    .catch(err => {
        console.error("Database initialization failed:", err);
        process.exit(1); // Exit if database initialization fails
    });

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const creditRoutes = require('./routes/credits');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const scanRoutes = require('./routes/scan');

// API routes should come after page routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user/profile', profileRoutes);
app.use('/api/scan', scanRoutes);

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
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'subscribe') {
                ws.userId = data.userId;
            }
        } catch (error) {
            console.error("WebSocket message error:", error);
        }
    });

    // Handle connection errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast to specific user
global.notifyUser = (userId, data) => {
    wss.clients.forEach(client => {
        if (client.userId === userId) {
            try {
                client.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        }
    });
};

// Replace app.listen with server.listen
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
