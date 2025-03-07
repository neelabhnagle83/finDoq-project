const db = require("../db");

// Create Documents Table
db.run(`
    CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        file_name TEXT,
        content TEXT,
        size INTEGER,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
`, (err) => {
    if (err) console.error("❌ Error creating documents table:", err.message);
    else console.log("✅ Documents table created (if not exists)");
});

// Function to insert a new document
function addDocument(userId, fileName, content, fileSize, callback) {
    db.run(
        `INSERT INTO documents (user_id, file_name, content, size, uploaded_at) VALUES (?, ?, ?, ?, DATETIME('now'))`,
        [userId, fileName, content, fileSize],
        function (err) {
            if (err) {
                return callback(err);
            }
            callback(null, this.lastID);
        }
    );
}

// Function to get documents by user ID
function getDocumentsByUserId(userId, callback) {
    db.all(
        `SELECT * FROM documents WHERE user_id = ?`,
        [userId],
        (err, rows) => {
            if (err) {
                return callback(err);
            }
            callback(null, rows);
        }
    );
}

module.exports = {
    addDocument,
    getDocumentsByUserId,
};