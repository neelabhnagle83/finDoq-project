const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database('./database.db', sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("❌ Database connection error:", err.message);
    } else {
        console.log("✅ Connected to SQLite database.");
    }
});

// Check if the connection is working by running a simple query:
db.get("SELECT 1", (err, row) => {
    if (err) {
        console.error("❌ Error with query:", err.message);
    } else {
        console.log("✅ Query successful:", row);
    }
});

module.exports = db;
