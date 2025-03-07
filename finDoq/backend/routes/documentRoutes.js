// documentRoutes.js

const express = require("express");
const multer = require("multer");
const db = require("../db");
const router = express.Router();

// Configure file storage
const upload = multer({ dest: "uploads/" });

// Upload Document
router.post("/upload", upload.single("file"), (req, res) => {
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const uploadDate = new Date().toISOString();

    // Store file metadata in the database
    db.run(
        "INSERT INTO documents (user_id, file_name, content) VALUES (?, ?, ?)",
        [req.body.userId, fileName, filePath],
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

module.exports = router;
