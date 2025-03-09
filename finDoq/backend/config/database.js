const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Use findOq.db in the data folder
const db = new sqlite3.Database(path.join(dataDir, 'findOq.db'));

function initializeTables() {
    db.serialize(() => {
        console.log("Initializing database tables...");
        
        // Create users table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            credits INTEGER DEFAULT 20,
            lastCreditReset TEXT
        )`);

        // Create documents table with contentHash column
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            filename TEXT,
            content TEXT,
            contentHash TEXT,
            uploadDate TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )`, (err) => {
            if (err) {
                console.error("Error creating documents table:", err);
            } else {
                console.log("Documents table initialized or already exists");
                // Ensure contentHash column exists by attempting to add it
                // SQLite will ignore this if the column already exists
                db.run("ALTER TABLE documents ADD COLUMN contentHash TEXT", (alterErr) => {
                    // Ignore error if column already exists (it will say "duplicate column name")
                    if (alterErr && !alterErr.message.includes('duplicate column name')) {
                        console.error("Error adding contentHash column:", alterErr);
                    } else {
                        console.log("contentHash column exists or was added successfully");
                    }
                });
            }
        });

        // Create credit_requests table
        db.run(`CREATE TABLE IF NOT EXISTS credit_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            requestedCredits INTEGER,
            status TEXT DEFAULT 'pending',
            requestDate TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )`);

        // Create admin user if it doesn't exist
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
            if (!user) {
                db.run('INSERT INTO users (username, password, role, credits) VALUES (?, ?, ?, ?)',
                    ['admin', hashedPassword, 'admin', 999]);
            }
        });
    });
}

// Export the database connection and initialization function
module.exports = { db, initializeTables };
