const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const multer = require("multer");
const db = require("../db");
const router = express.Router();

// Configure file storage
const upload = multer({ dest: "uploads/" });

// Get user profile & credits
router.get("/profile", authenticateToken, (req, res) => {
    const username = req.user.username;

    db.get("SELECT username, credits FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching profile" });
        }
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        db.all("SELECT * FROM documents WHERE user_id = (SELECT id FROM users WHERE username = ?)", [username], (err, documents) => {
            if (err) {
                return res.status(500).json({ error: "Database error while fetching documents" });
            }

            db.all("SELECT * FROM credit_requests WHERE username = ?", [username], (err, requests) => {
                if (err) {
                    return res.status(500).json({ error: "Database error while fetching credit requests" });
                }

                res.json({
                    username: user.username,
                    credits: user.credits,
                    documents: documents,
                    creditRequests: requests
                });
            });
        });
    });
});

// Upload Document
router.post("/upload", authenticateToken, upload.single("file"), (req, res) => {
    const userId = req.user.userId;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const uploadDate = new Date().toISOString();

    // Check if user has enough credits
    db.get("SELECT credits FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching user credits" });
        }
        if (user.credits < 1) {
            return res.status(400).json({ error: "Insufficient credits" });
        }

        // Deduct 1 credit
        db.run("UPDATE users SET credits = credits - 1 WHERE id = ?", [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error while deducting credits" });
            }

            // Store file metadata in the database
            db.run(
                "INSERT INTO documents (user_id, file_name, content) VALUES (?, ?, ?)",
                [userId, fileName, filePath],
                (err) => {
                    if (err) return res.status(500).json({ error: "Database error" });
                    // Send the file metadata back to the frontend
                    res.json({
                        message: "File uploaded successfully",
                        file: {
                            fileName,
                            fileSize,
                            uploadDate,
                        },
                    });
                }
            );
        });
    });
});

// Deduct 1 credit after scanning
router.post("/deduct-credit", authenticateToken, (req, res) => {
    const userId = req.user.userId;

    db.get("SELECT credits FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: "Database error while fetching user credits" });
        }
        if (user.credits < 1) {
            return res.status(400).json({ error: "Insufficient credits" });
        }

        // Deduct 1 credit
        db.run("UPDATE users SET credits = credits - 1 WHERE id = ?", [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: "Database error while deducting credits" });
            }
            res.json({ success: true, message: "Credit deducted successfully" });
        });
    });
});

module.exports = router;