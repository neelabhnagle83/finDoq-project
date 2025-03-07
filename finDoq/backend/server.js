const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "finDoq@098";
const { authenticateToken } = require("./middleware/authMiddleware");
const { requestCredits } = require(path.join(__dirname, "../frontend/js/mainCredit"));
const multer = require("multer");
const { addDocument } = require("./models/documentModel");
const fs = require('fs'); // Added for file system operations

const app = express();
app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "../backend/database.db");
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error("❌ Error connecting to database:", err.message);
    } else {
        console.log("✅ Connected to SQLite database.");
    }
});

// ... (rest of your code) ...

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



// Create the 'users' table only
db.run(
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 20
    );`,
    (err) => {
        if (err) console.error("❌ Error creating users table:", err.message);
        else console.log("✅ Users table created");
    }
);

// Create the 'credit_requests' table for storing credit requests
db.run(
    `CREATE TABLE IF NOT EXISTS credit_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        creditsRequested INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
    );`,
    (err) => {
        if (err) console.error("❌ Error creating credit_requests table:", err.message);
        else console.log("✅ Credit requests table created");
    }
);

// Home route
app.get("/", (req, res) => {
    res.send("🔥 Server is running!");
});

// Get current user's credits
app.get("/user/credits", authenticateToken, (req, res) => {
    const username = req.user.username; // Extracting the username from the token

    // Query the database using the username to fetch credits
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

// Request more credits
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

          // If no pending request, insert the new credit request into the database with a status of 'pending'
          db.run("INSERT INTO credit_requests (username, creditsRequested, status) VALUES (?, ?, 'pending')", [uname, requestedCredits], function (err) {
              if (err) {
                  return res.status(500).json({ error: err.message });
              }
              res.json({ message: "Your credit request has been submitted and is awaiting admin approval." });
          });
      });
  });
});


// User signup
app.post("/signup", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required!" });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, existingUser) => {
        if (err) return res.status(500).json({ error: "Database error while checking user" });
        if (existingUser) return res.status(409).json({ error: "Username already exists. Please choose another." });

        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
            "INSERT INTO users (username, password, role, credits) VALUES (?, ?, 'user', 20)",
            [username, hashedPassword],
            function (err) {
                if (err) return res.status(500).json({ error: "Database error while creating user" });
                res.json({ message: "User registered successfully!", username: this.lastID });
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
        if (err) return res.status(500).json({ error: "Database error while fetching user" });
        if (!user) return res.status(401).json({ error: "Invalid username or password!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password!" });
        }

        const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "1h" });

        res.json({ message: "Login successful!", token, role: user.role });
    });
});

// Admin login
app.post("/admin/login", async (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: "Database error while fetching user" });
        if (!user || user.role !== "admin") return res.status(401).json({ error: "Invalid admin credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }

        const token = jwt.sign({ username: user.username, role: "admin" }, SECRET_KEY, { expiresIn: "1h" });

        res.json({ message: "Admin login successful!", token, role: "admin" });
    });
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
        FROM users
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

app.get("/debug/users", (req, res) => {
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching users." });
        }
        res.json({ users: rows });
    });
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post("/upload", authenticateToken, upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }

    if (req.file.mimetype !== "text/plain") {
        return res.status(400).json({ error: "Please upload only text files (.txt)." });
    }

    const username = req.user.username;
    const filename = req.file.originalname;
    const content = req.file.buffer.toString("utf-8");
    const fileSize = req.file.size;

    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: "User not found." });
        }

        const userId = row.id;

        function addDocument(userId, filename, content, fileSize, callback) {
            db.run(
                "INSERT INTO documents (user_id, file_name, content, size, uploaded_at) VALUES (?, ?, ?, ?, DATETIME('now'))",
                [userId, filename, content, fileSize],
                function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, this.lastID);
                    }
                }
            );
        }

        addDocument(userId, filename, content, fileSize, (err, documentId) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({ message: "File uploaded successfully.", documentId: documentId });
        });
    });
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

        console.log(`Server: User with ID ${userId} deleted from database.`);

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

// deleting 

app.delete("/admin/files/:fileId", authenticateToken, (req, res) => {
  // ... admin check ...

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
      const filePath = path.join(__dirname, 'uploads', fileName);
      console.log(`Server: File path: ${filePath}`);

      try {
          fs.unlinkSync(filePath);
          console.log(`Server: File ${fileName} deleted from file system.`);
      } catch (fileErr) {
          console.error(`Server: Error deleting file ${fileName} from file system:`, fileErr);
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



// Start the server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
