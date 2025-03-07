const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "finDoq@098";
const { authenticateToken } = require("./middleware/authMiddleware");
const multer = require("multer");
const { addDocument } = require("./models/documentModel");
const fs = require('fs'); // Added for file system operations

const app = express();
app.use(express.json());
// Modify CORS configuration to allow requests from http://127.0.0.1:5500
app.use(cors({
    origin: 'http://127.0.0.1:5500',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
})); // Enable CORS for all routes

const dbPath = path.join(__dirname, "../backend/database.db");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("❌ Error connecting to database:", err.message);
    } else {
        console.log("✅ Connected to SQLite database.");
    }
});

// Ensure an admin exists in the database
const adminUsername = "admin";
const adminPassword = "admin123";

db.get("SELECT * FROM users WHERE username = ?", [adminUsername], (err, admin) => {
    if (err) {
        console.error("❌ Error checking admin:", err.message);
    } else if (!admin) {
        bcrypt.hash(adminPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error("❌ Error hashing admin password:", err);
            } else {
                db.run(
                    "INSERT INTO users (username, password, role, credits) VALUES (?, ?, 'admin', 9999)",
                    [adminUsername, hashedPassword],
                    function (err) {
                        if (err) console.error("❌ Error inserting admin:", err.message);
                        else console.log("✅ Admin user created successfully!");
                    }
                );
            }
        });
    }
});

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const creditRoutes = require("./routes/creditRoutes");
const documentRoutes = require("./routes/documentRoutes");
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/credits", creditRoutes);
app.use("/documents", documentRoutes);

// Reset user credits to 20 at midnight
const resetUserCredits = () => {
    db.run("UPDATE users SET credits = 20", (err) => {
        if (err) {
            console.error("❌ Error resetting user credits:", err.message);
        } else {
            console.log("✅ User credits reset to 20");
        }
    });
};

// Schedule the reset to run at midnight
const scheduleDailyReset = () => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const now = new Date();
    const timeToMidnight = midnight.getTime() - now.getTime();
    setTimeout(() => {
        resetUserCredits();
        setInterval(resetUserCredits, 24 * 60 * 60 * 1000); // Repeat every 24 hours
    }, timeToMidnight);
};
scheduleDailyReset();

// deleting 
app.delete("/admin/files/:fileId", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        console.log(`Server: Unauthorized delete attempt for file ID ${req.params.fileId}`);
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const fileId = req.params.fileId;
    console.log(`Server: Deleting file with ID ${fileId}`);

    db.get("SELECT file_name FROM documents WHERE id = ?", [fileId], (err, row) => {
        if (err) {
            console.error("Server: Error retrieving file name:", err);
            return res.status(500).json({ error: "Error retrieving file name." });
        }
        if (!row) {
            console.log("Server: File not found in database.");
            return res.status(404).json({ error: "File not found in database." });
        }
        const fileName = row.file_name;

        // Corrected filePath construction
        const uploadsDir = path.join(__dirname, 'uploads'); // Assuming 'uploads' is in the same directory as server.js
        const filePath = path.join(uploadsDir, fileName);

        console.log(`Server: File path: ${filePath}`);
        // Check if the file exists before attempting to delete
        fs.access(filePath, fs.constants.F_OK, (accessErr) => {
            if (accessErr) {
                console.error(`Server: File ${fileName} not found in file system. Error:`, accessErr);
                // Even if the file is not found, we will still remove from database.
            } else {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Server: File ${fileName} deleted from file system.`);
                } catch (fileErr) {
                    console.error(`Server: Error deleting file ${fileName} from file system:`, fileErr);
                }
            }

            console.log("Server: Database deletion started.");
            db.run("DELETE FROM documents WHERE id = ?", [fileId], function (dbErr) {
                if (dbErr) {
                    console.error("Server: Error deleting file from database:", dbErr);
                    return res.status(500).json({ error: "Error deleting file from database." });
                }
                console.log("Server: Database deletion finished.");
                res.json({ message: "File deleted successfully." });
            });
        });
    });
});

// Function to handle credit requests
const requestCredits = (username, requestedCredits, callback) => {
    // Check if the user exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            console.error("Error fetching user:", err);
            return callback({ error: "Database error while fetching user" });
        }

        if (!user) {
            return callback({ error: "User not found" });
        }

        // Check if the requested credits are valid
        if (requestedCredits <= 0 || requestedCredits > 10) {
            return callback({ error: "Requested credits must be between 1 and 10" });
        }

        // Insert the credit request into the database
        db.run(
            "INSERT INTO credit_requests (username, creditsRequested, status) VALUES (?, ?, 'pending')",
            [username, requestedCredits],
            function (err) {
                if (err) {
                    console.error("Error inserting credit request:", err);
                    return callback({ error: "Database error while inserting credit request" });
                }
                callback(null, { message: "Credit request submitted successfully" });
            }
        );
    });
};

// Home route
app.get("/", (req, res) => {
    res.send("🔥 Server is running!");
});

// Get current user's credits
app.get("/user/credits", authenticateToken, (req, res) => {
    const username = req.user.username; // Extract username from the token
    db.get("SELECT credits FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            res.json({ credits: row.credits });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    });
});

// Deduct 1 credit after scanning
app.post("/user/deduct-credit", authenticateToken, (req, res) => {
    const username = req.user.username;
    db.get("SELECT credits FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching user credits" });
        }
        if (user.credits < 1) {
            return res.status(400).json({ error: "Insufficient credits" });
        }

        // Deduct 1 credit
        db.run("UPDATE users SET credits = credits - 1 WHERE username = ?", [username], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error while deducting credits" });
            }
            res.json({ success: true, message: "Credit deducted successfully" });
        });
    });
});

// Request more credits
app.post("/user/request-credits", authenticateToken, (req, res) => {
    const uname = req.user.username; // Change from to username
    const { requestedCredits } = req.body;

    // Make sure the credits are between 0 and 10
    if (requestedCredits < 0 || requestedCredits > 10) {
        return res.status(400).json({ error: "Requested credits should be between 0 and 10." });
    }

    // Check if the user already has a pending credit request
    db.get("SELECT * FROM credit_requests WHERE username = ? AND status = 'pending'", [uname], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row) {
            // If a pending request exists, prevent another request
            return res.status(400).json({ error: "You already have a pending credit request. Please wait for admin approval." });
        }

        // Call the requestCredits function from mainCredit.js
        requestCredits(uname, requestedCredits, (err, data) => {
            if (err) {
                return res.status(400).json(err); // Return error if any
            }
            res.json({ message: "Your credit request has been submitted and is awaiting admin approval." });
        });
    });
});

// Admin accept credit request
app.post("/admin/credit-requests/:requestId/accept", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const requestId = req.params.requestId;

    // Get the credit request from the database
    db.get("SELECT username, creditsRequested FROM credit_requests WHERE id = ?", [requestId], (err, request) => {
        if (err) {
            console.error("Error fetching credit request:", err);
            return res.status(500).json({ error: "Error fetching credit request." });
        }
        if (!request) {
            return res.status(404).json({ error: "Credit request not found." });
        }
        const { username, creditsRequested } = request;

        // Update the user's credits
        db.run("UPDATE users SET credits = credits + ? WHERE username = ?", [creditsRequested, username], function (err) {
            if (err) {
                console.error("Error updating user credits:", err);
                return res.status(500).json({ error: "Error updating user credits." });
            }

            // Update the credit request status to 'accepted'
            db.run("UPDATE credit_requests SET status = 'accepted' WHERE id = ?", [requestId], function (err) {
                if (err) {
                    console.error("Error updating credit request status:", err);
                    return res.status(500).json({ error: "Error updating credit request status." });
                }
                res.json({ message: "Credit request accepted successfully." });
            });
        });
    });
});

// Admin reject credit request
app.post("/admin/credit-requests/:requestId/reject", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const requestId = req.params.requestId;

    // Update the credit request status to 'rejected'
    db.run("UPDATE credit_requests SET status = 'rejected' WHERE id = ?", [requestId], function (err) {
        if (err) {
            console.error("Error updating credit request status:", err);
            return res.status(500).json({ error: "Error updating credit request status." });
        }
        res.json({ message: "Credit request rejected successfully." });
    });
});

// Admin get all credit requests
app.get("/admin/credit-requests", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const query = `
        SELECT 
            credit_requests.id,
            credit_requests.username,
            credit_requests.creditsRequested,
            credit_requests.status
        FROM 
            credit_requests;
    `;
    db.all(query, (err, rows) => {
        if (err) {
            console.error("Error fetching credit requests:", err);
            return res.status(500).json({ error: "Error fetching credit requests." });
        }
        res.json({ requests: rows });
    });
});

// User signup
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, existingUser) => {
        if (err) {
            return res.status(500).json({ error: "Database error while checking user" });
        }
        if (existingUser) {
            return res.status(409).json({ error: "Username already exists. Please choose another." });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            "INSERT INTO users (username, password, role, credits) VALUES (?, ?, 'user', 20)",
            [username, hashedPassword],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: "Database error while creating user" });
                }
                res.json({ message: "User registered successfully!", userId: this.lastID });
            }
        );
    });
});

// User login
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching user" });
        }
        if (!user) {
            return res.status(401).json({ error: "Invalid username or password!" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password!" });
        }
        const token = jwt.sign({ 
            userId: user.id,
            username: user.username, 
            role: user.role  
        }, SECRET_KEY, { 
            expiresIn: "24h" 
        });
        res.json({ 
            message: "Login successful!", 
            token, 
            role: user.role 
        });
    });
});

// Admin login
app.post("/admin/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching user" });
        }
        if (!user || user.role !== "admin") {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }
        const token = jwt.sign({ 
            userId: user.id,
            username: user.username, 
            role: "admin" 
        }, SECRET_KEY, { 
            expiresIn: "24h" 
        });
        res.json({ 
            message: "Admin login successful!", 
            token, 
            role: "admin" 
        });
    });
});

// Admin get all users
app.get("/admin/users", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    // Query to get all users with file counts
    const query = `
        SELECT 
            users.id,
            users.username,
            users.role,
            users.credits,
            COUNT(documents.user_id) AS filesUploaded
        FROM 
            users
        LEFT JOIN documents ON users.id = documents.user_id
        GROUP BY users.id;
    `;
    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching users." });
        }
        res.json({ users: rows });
    });
});

// Function to calculate text similarity (Jaccard Index)
function calculateTextSimilarity(text1, text2) {
    const set1 = new Set(text1.toLowerCase().split(/\s+/));
    const set2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    // Handle edge case where both sets are empty
    if (union.size === 0) {
        return 1; // Consider them identical if both are empty
    }

    const similarity = intersection.size / union.size;
    return similarity;
}

// Re-add authenticateToken middleware
app.post("/scan/:documentId", authenticateToken, async (req, res) => {
    const documentId = req.params.documentId;
    console.log(`Scan request received for document ID: ${documentId}`);
    console.log(`Authorization header: ${req.headers.authorization}`);
    console.log(`User from token: ${JSON.stringify(req.user)}`);

    try {
        const document = await new Promise((resolve, reject) => {
            db.get("SELECT id, file_name, content, user_id FROM documents WHERE id = ?", [documentId], (err, doc) => {
                if (err) {
                    console.error("Database error:", err);
                    return reject(err);
                }
                resolve(doc);
            });
        });

        if (!document) {
            console.log(`Document not found with ID: ${documentId}`);
            return res.status(404).json({ success: false, error: "Document not found." });
        }
        console.log(`Document found: ${document.id, document.file_name}`);

        const existingDocuments = await new Promise((resolve, reject) => {
            db.all("SELECT id, file_name, content FROM documents WHERE user_id != ?", [document.user_id], (err, docs) => {
                if (err) {
                    console.error("Database error:", err);
                    return reject(err);
                }
                resolve(docs);
            });
        });

        console.log(`Number of existing documents: ${existingDocuments.length}`);
        let similarDocuments = [];
        existingDocuments.forEach(doc => {
            const similarity = calculateTextSimilarity(document.content, doc.content);
            if (similarity > 0.1) {
                similarDocuments.push({
                    id: doc.id,
                    file_name: doc.file_name,
                    similarity: similarity
                });
            }
        });
        console.log("Similar documents:", similarDocuments);
        return res.status(200)
            .header('Content-Type', 'application/json')
            .json({
                success: true,
                similarDocuments: similarDocuments
            });
    } catch (error) {
        console.error("Scan error:", error);
        return res.status(500)
            .header('Content-Type', 'application/json')
            .json({
                success: false,
                error: "Internal server error during scan"
            });
    }
});

// ... (Your other imports and code) ...
app.delete("/admin/users/:userId", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        console.log(`Server: Unauthorized delete attempt for user ID ${req.params.userId}`);
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
    const userId = req.params.userId;
    console.log(`Server: Deleting user with ID ${userId}`);

    // Delete the user from the database
    db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
        if (err) {
            console.error(`Server: Error deleting user ID ${userId} from database:`, err);
            return res.status(500).json({ error: "Error deleting user." });
        }
        console.log(`Server: Rows affected by DELETE: ${this.changes}`);
        if (this.changes === 0) {
            console.log(`Server: User with ID ${userId} not found in database.`);
            return res.status(404).json({ error: "User not found." });
        }

        // **Run VACUUM to permanently remove deleted user**
        db.run("VACUUM", (vacuumErr) => {
            if (vacuumErr) {
                console.error("Server: Error optimizing database after delete:", vacuumErr);
                return res.status(500).json({ error: "Error optimizing database." });
            }
            console.log("Server: Database optimized after deletion.");
            return res.json({ message: "User deleted successfully." });
        });
    });
});

// Get user documents
app.get("/user/documents", authenticateToken, (req, res) => {
    const username = req.user.username;
    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "User not found." });
        }
        const userId = row.id;
        db.all("SELECT file_name, id FROM documents WHERE user_id = ?", [userId], (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ documents: rows });
        });
    });
});

//view endpoint
app.get("/view/:documentId", authenticateToken, (req, res) => {
    const documentId = req.params.documentId;
    db.get("SELECT content FROM documents WHERE id = ?", [documentId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Document not found" });
        }
        res.send(row.content);
    });
});

//download endpoint
app.get("/download/:documentId", authenticateToken, (req, res) => {
    const documentId = req.params.documentId;
    db.get("SELECT file_name, content FROM documents WHERE id = ?", [documentId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: "Document not found" });
        }
        res.setHeader('Content-disposition', 'attachment; filename=' + row.file_name);
        res.setHeader('Content-type', 'text/plain');
        res.send(row.content);
    });
});

app.get("/admin/files", authenticateToken, (req, res) => {
    // Ensure the user is an admin
    if (req.user.role !== "admin") {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }

    const query = `
    SELECT 
        id, 
        file_name AS fileName, 
        uploaded_at AS uploadedAt, 
        size 
    FROM 
        documents;
    `;

    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching files." });
        }
        res.json({ files: rows });
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});