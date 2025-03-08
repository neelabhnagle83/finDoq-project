const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/findoq.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            credits INTEGER DEFAULT 20,
            lastCreditReset TEXT
        )`);

        // Documents table
        db.run(`CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            filename TEXT,
            content TEXT,
            uploadDate TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )`);

        // Credit requests table
        db.run(`CREATE TABLE IF NOT EXISTS credit_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER,
            requestedCredits INTEGER,
            status TEXT DEFAULT 'pending',
            requestDate TEXT,
            FOREIGN KEY(userId) REFERENCES users(id)
        )`);

        // Create admin user if not exists
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync('admin123', 10);
        
        db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
            if (err) console.error('Error checking admin:', err);
            if (!user) {
                db.run(
                    'INSERT INTO users (username, password, role, credits) VALUES (?, ?, ?, ?)',
                    ['admin', hashedPassword, 'admin', 999],
                    (err) => {
                        if (err) console.error('Error creating admin:', err);
                        else console.log('Admin user created successfully');
                    }
                );
            }
        });

        // Add some test documents if needed
        db.get('SELECT COUNT(*) as count FROM documents', (err, result) => {
            if (err) console.error('Error checking documents:', err);
            if (result.count === 0) {
                const sampleDocs = [
                    { content: 'Sample document 1 for testing purposes.', filename: 'test1.txt' },
                    { content: 'Another sample document with different content.', filename: 'test2.txt' }
                ];
                
                sampleDocs.forEach(doc => {
                    db.run(
                        'INSERT INTO documents (userId, filename, content, uploadDate) VALUES (?, ?, ?, datetime("now"))',
                        [1, doc.filename, doc.content]
                    );
                });
                console.log('Sample documents created');
            }
        });
    });
}

module.exports = db;
