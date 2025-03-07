// documentRoutes.js

const express = require("express");
const multer = require("multer");
const db = require("../db");
const { authenticateToken } = require("../middleware/authMiddleware");
const router = express.Router();

// Configure file storage
const upload = multer({ dest: "uploads/" });

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

module.exports = router;
