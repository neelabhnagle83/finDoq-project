const { db } = require('../config/database');

/**
 * Runs database migrations to ensure schema is up-to-date
 * @returns {Promise} A promise that resolves when migrations complete
 */
function runMigrations() {
    console.log("Running database migrations...");
    
    // Return the promise chain
    return addColumnIfNotExists('documents', 'contentHash', 'TEXT')
        .then(() => {
            console.log("Migrations completed successfully");
            // You can add more migrations here by chaining more .then() calls
            return true; // explicitly return a value to indicate success
        })
        .catch(err => {
            console.error("Error during migrations:", err);
            throw err; // re-throw to allow error handling up the chain
        });
}

/**
 * Helper function to add a column to a table if it doesn't exist
 */
function addColumnIfNotExists(table, column, type) {
    return new Promise((resolve, reject) => {
        // Use db.all instead of db.get to get all columns
        db.all(`PRAGMA table_info(${table})`, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Check if column exists in the returned rows
            const columnExists = Array.isArray(rows) && rows.some(row => row.name === column);
            
            if (!columnExists) {
                console.log(`Adding ${column} column to ${table} table`);
                db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log(`Successfully added ${column} column to ${table} table`);
                        resolve();
                    }
                });
            } else {
                console.log(`Column ${column} already exists in ${table} table`);
                resolve();
            }
        });
    });
}

module.exports = { runMigrations };
